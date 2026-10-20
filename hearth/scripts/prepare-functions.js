/**
 * Copies companions/ into functions/ before a deploy.
 *
 * Runs as the firebase.json predeploy hook. Written in Node rather than as a
 * shell one-liner because the hook runs through cmd.exe on Windows, where cp
 * and rm do not exist.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'companions');
const dest = path.join(root, 'functions', 'companions');

if (!fs.existsSync(src)) {
  console.error('prepare-functions: no companions/ directory at ' + src);
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });

let n = 0;
for (const name of fs.readdirSync(src)) {
  if (!name.endsWith('.json')) continue;
  fs.copyFileSync(path.join(src, name), path.join(dest, name));
  n++;
}

if (!n) { console.error('prepare-functions: no .json files in companions/'); process.exit(1); }
console.log('prepare-functions: copied ' + n + ' companion file' + (n === 1 ? '' : 's') + ' into functions/');
