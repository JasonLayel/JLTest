# Setting up Hearth

One pass, start to finish. You only do this once. Everything after it is
double-clicking `Deploy Hearth.bat`.

Where the steps say "console", that is a web page in your browser, not a
terminal. The only terminal work is step 4, and only the first time.

---

## 1. Make the Firebase project

1. Go to <https://console.firebase.google.com> and sign in.
2. Click **Create a project** (or **Add project**).
3. Name it something like `hearth-companion`. The real project ID appears
   under the name, something like `hearth-companion-4f2a1`. **Write that ID
   down**, you need it in step 4.
4. Google Analytics: turn it **off**. You do not need it.
5. Click **Create project**, wait, then **Continue**.

## 2. Move it to the Blaze plan

Cloud Functions do not run on the free Spark plan. Blaze is pay as you go and
has a free tier underneath it, so at your volume the Firebase side costs
nothing. The Anthropic usage is separate and is the roughly $1.50 to $3 a
month.

1. Bottom left of the console, find the plan name and click **Upgrade**.
2. Choose **Blaze**, attach a billing account, confirm.
3. While you are there, Firebase offers a **budget alert**. Set one at $5.
   It will never fire, and it means you find out if something is wrong.

## 3. Create the Firestore database

This is the bit sync needs.

1. In the left sidebar, open **Firestore Database**. Depending on how new your
   console is, it sits under **Build** or under **Databases & Storage**.
2. Click **Create database**.
3. **If it asks which edition, pick Standard.**
4. **If it asks for a Database ID, leave it as `(default)`.** This matters.
   The app asks for the default database by name, so a database called
   anything else will look like it does not exist.
5. **Location:** pick a US east region, for example `nam5 (United States)` or
   `us-east1`. **You cannot change this later.** If the location picker is
   greyed out, your project already has one set and that is fine.
6. **Security rules:** choose **Production mode** (sometimes worded as "Start
   in production mode"). This locks the database so no browser can read it.
   That is exactly what you want here: only the Cloud Function touches
   Firestore, and it goes in as an administrator, so these rules do not apply
   to it. Test mode would leave your sessions open to anyone.
7. Click **Create** and wait for it to finish.

You never have to open this page again.

## 4. Connect and deploy, once

Open a terminal in the `hearth` folder. This is the only terminal step.

```sh
npm install -g firebase-tools
firebase login
firebase use --add
```

`firebase use --add` lists your projects. Pick the one from step 1 and give it
the alias `default` when it asks.

Now give it your Anthropic key. Get one at
<https://console.anthropic.com> under API keys.

```sh
firebase functions:secrets:set ANTHROPIC_API_KEY
```

It prompts for the value. Paste the key and press enter. It does not echo as
you type, which is normal.

**Set a spend limit in the Anthropic console while you are there.** Billing,
then limits. That is the real cap on cost. Everything in the function is a
seatbelt, not a budget.

Then deploy:

```sh
firebase deploy --only functions,hosting
```

The first deploy takes a few minutes and may ask permission to enable some
Google APIs. Say yes. When it finishes it prints a **Hosting URL** like
`https://hearth-companion-4f2a1.web.app`. That is the app.

## 5. Check the voice

Open the Hosting URL. Go to **Settings**, then **Run voice check**.

It fires five situations at the companion and shows what comes back, including
you saying a drawing looks awful and you calling yourself lazy. Read the
replies. If the voice is wrong, that is fixable in `companions/hearth.json`
and `functions/index.js`, and it is much easier to fix now than after a month
of sessions.

## 6. Turn on sync

On the PC, in **Settings**, type a phrase into the sync box. Make it a real
phrase, eight characters or more, something like `drawing-afternoons`. Click
**Save**. It should say synced.

On the phone, open the same Hosting URL, bookmark it or use Chrome's **Add to
Home screen**, then Settings, then type the **same phrase** and save. The
phone should pull down whatever the PC already has.

That phrase is the only key to your data. Anyone who has it can read your
sessions, so do not make it `password`.

## After that

Double-click `Deploy Hearth.bat` whenever you want to push changes. It does
the same deploy as step 4 and keeps the window open so you can read what
happened.

---

## If something goes wrong

**Settings says sync is unavailable.** Firestore is not created, or it is not
the `(default)` database. Go back to step 3.

**Sync fails with a permissions error in the function logs.** Second
generation functions run as the Compute Engine default service account, and on
some newer projects that account does not get Firestore access automatically.
Open <https://console.cloud.google.com/iam-admin/iam>, pick your project, find
the account ending in `-compute@developer.gserviceaccount.com`, edit it, and
add the role **Cloud Datastore User**. Redeploy.

**The companion never answers but the app works.** The function is not
deployed, or the secret is not set. Run `firebase deploy --only functions`
again and watch for errors. Logs are at
<https://console.firebase.google.com> under Functions.

**The deploy fails on the predeploy step.** It runs
`node scripts/prepare-functions.js`, which copies `companions/` into
`functions/`. Make sure you are running the deploy from inside the `hearth`
folder.

**You want to see what it actually sent.** Firebase console, Functions, Logs.
The style filter writes a line every time it rejects a reply, which tells you
the companion tried to say something off-key and was caught.
