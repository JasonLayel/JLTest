#!/usr/bin/env node
/**
 * Emails the current digest.
 *
 * Reads what collect.mjs wrote and sends it as a multipart (plain + HTML)
 * message over SMTP. Zero dependencies — node:tls speaks SMTP directly — so
 * the workflow needs no third-party action holding the mail credentials.
 *
 * Required to actually send (repository secrets):
 *   DIGEST_SMTP_USER   e.g. you@gmail.com
 *   DIGEST_SMTP_PASS   an app password, never your account password
 * Optional:
 *   DIGEST_TO          recipient (default: DIGEST_SMTP_USER)
 *   DIGEST_SMTP_HOST   default smtp.gmail.com
 *   DIGEST_SMTP_PORT   default 465 (implicit TLS)
 *   DIGEST_FROM_NAME   default "Daily Art Digest"
 *
 * With no credentials it prints what it would have sent and exits 0, so the
 * collection workflow still succeeds.
 *
 *   node art-digest/send-email.mjs [--dry-run]
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { connect } from 'node:tls';
import { randomUUID } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = process.env.ART_DIGEST_OUT || join(HERE, 'data');
const SITE = 'https://petulent-princess-productivity.web.app/art-digest/';

/* ---------------------------------------------------------------- message */

const b64 = (text) => Buffer.from(text, 'utf8').toString('base64');
const wrap = (text) => b64(text).replace(/(.{76})/g, '$1\r\n');
/** RFC 2047, so emoji and non-Latin titles survive the subject line. */
const encodeHeader = (text) =>
  /^[\x20-\x7e]*$/.test(text) ? text : `=?UTF-8?B?${b64(text)}?=`;

export function plainTextDigest(digest) {
  const lines = [`Today's best new digital art — ${digest.items.length} picks`, ''];
  digest.items.forEach((item, i) => {
    lines.push(
      `${i + 1}. ${item.title}${item.artist ? ` — ${item.artist}` : ''}`,
      `   ${digest.sourceLabels?.[item.source] || item.source} · ${item.scoreLabel} · heat ${item.heat}`,
      `   ${item.url}`,
      ''
    );
  });
  const trouble = (digest.sources || []).filter((s) => s.status !== 'ok');
  if (trouble.length) {
    lines.push(`Unavailable in this run: ${trouble.map((s) => s.label).join(', ')}`, '');
  }
  lines.push(`All of it, filterable: ${SITE}`);
  return lines.join('\n');
}

export function buildMessage({ digest, html, from, fromName, to, date = new Date() }) {
  const boundary = `=_art_digest_${randomUUID()}`;
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return [
    `From: ${encodeHeader(fromName)} <${from}>`,
    `To: ${to}`,
    `Subject: ${encodeHeader(`🎨 Today's best new digital art — ${digest.items.length} picks (${day})`)}`,
    `Date: ${date.toUTCString()}`,
    `Message-ID: <${randomUUID()}@art-digest>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap(plainTextDigest(digest)),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap(html),
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

/* ------------------------------------------------------------------- smtp */

/** Minimal SMTP over implicit TLS: greeting, EHLO, AUTH LOGIN, MAIL/RCPT/DATA. */
export async function sendSmtp({ host, port, user, pass, from, to, message, timeout = 30_000, tlsOptions = {} }) {
  const socket = connect({ host, port, servername: host, ...tlsOptions });
  socket.setEncoding('utf8');

  let buffer = '';
  let waiting = null;
  const complete = () => /(?:^|\n)\d{3} [^\n]*\n$/.test(buffer);

  socket.on('data', (chunk) => {
    buffer += chunk;
    if (waiting && complete()) {
      const response = buffer;
      buffer = '';
      const { resolve } = waiting;
      waiting = null;
      resolve(response);
    }
  });

  const fail = (err) => {
    if (waiting) waiting.reject(err);
    waiting = null;
  };
  socket.on('error', fail);
  socket.on('close', () => fail(new Error('SMTP connection closed early')));
  socket.setTimeout(timeout, () => fail(new Error('SMTP timed out')));

  const read = () =>
    new Promise((resolve, reject) => {
      if (complete()) {
        const response = buffer;
        buffer = '';
        resolve(response);
        return;
      }
      waiting = { resolve, reject };
    });

  const say = async (line, expect, redact = false) => {
    socket.write(`${line}\r\n`);
    const response = await read();
    const code = Number(response.trim().split(/\r?\n/).at(-1).slice(0, 3));
    if (!expect.includes(code)) {
      throw new Error(`SMTP ${redact ? '<credentials>' : line.split(':')[0]} → ${response.trim()}`);
    }
    return response;
  };

  try {
    await read(); // 220 greeting
    await say(`EHLO ${host}`, [250]);
    await say('AUTH LOGIN', [334]);
    await say(b64(user), [334], true);
    await say(b64(pass), [235], true);
    await say(`MAIL FROM:<${from}>`, [250]);
    await say(`RCPT TO:<${to}>`, [250, 251]);
    await say('DATA', [354]);
    // Dot-stuffing: a lone "." would end the message early.
    socket.write(`${message.replace(/\r\n\./g, '\r\n..')}\r\n.\r\n`);
    const result = await read();
    if (!/^2\d\d/m.test(result.trim())) throw new Error(`SMTP DATA → ${result.trim()}`);
    socket.write('QUIT\r\n');
    return result.trim();
  } finally {
    socket.end();
  }
}

/* ------------------------------------------------------------------- main */

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const digest = JSON.parse(await readFile(join(DATA, 'latest.json'), 'utf8'));
  const html = await readFile(join(DATA, 'email.html'), 'utf8');

  const user = process.env.DIGEST_SMTP_USER;
  const pass = process.env.DIGEST_SMTP_PASS;
  const to = process.env.DIGEST_TO || user;

  const ageHours = (Date.now() - Date.parse(digest.generatedAt)) / 3.6e6;
  if (ageHours > 48) {
    console.error(`Digest is ${Math.round(ageHours)}h old; refusing to send stale art.`);
    process.exitCode = 1;
    return;
  }
  if (!digest.items.length) {
    console.error('Digest is empty; nothing to send.');
    process.exitCode = 1;
    return;
  }

  const message = buildMessage({
    digest,
    html,
    from: user || 'art-digest@localhost',
    fromName: process.env.DIGEST_FROM_NAME || 'Daily Art Digest',
    to: to || 'nobody@localhost',
  });

  if (dryRun || !user || !pass) {
    console.log(
      dryRun
        ? '--dry-run: not sending. Message follows.\n'
        : 'DIGEST_SMTP_USER / DIGEST_SMTP_PASS are not set, so no email was sent.\n' +
            'See art-digest/README.md to turn the daily email on. Preview:\n'
    );
    console.log(plainTextDigest(digest));
    if (dryRun) console.log(`\n--- headers ---\n${message.slice(0, message.indexOf('\r\n\r\n'))}`);
    return;
  }

  const result = await sendSmtp({
    host: process.env.DIGEST_SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.DIGEST_SMTP_PORT) || 465,
    user,
    pass,
    from: user,
    to,
    message,
  });
  console.log(`Sent ${digest.items.length} picks to ${to} (${result})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
