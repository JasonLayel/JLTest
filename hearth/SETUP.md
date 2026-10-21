# Setting up Hearth

One pass, start to finish. You only do this once. Everything after it is
double-clicking `Deploy Hearth.bat`.

Step 0 is **a file you save**. Steps 1 to 3 are **web pages in a browser**.
Step 4 is **a file you double-click**. There is no terminal in any of this.

---

## 0. Get the files onto your PC

The code does not live on your computer yet. It lives on GitHub. You need a
copy on your PC before anything else works.

1. Save the `hearth.zip` file Claude sent you. It lands in your **Downloads**
   folder.
2. Open your Downloads folder, **right-click `hearth.zip`**, choose
   **Extract All...**, then click **Extract**.
3. You now have a folder called `hearth`. Drag it somewhere you will find it
   again, for example `C:\Users\jason\hearth`.
4. Open it. You should see `First Time Setup.bat`, `app.js`, `index.html` and
   about a dozen others. That folder is what every later step means by "the
   `hearth` folder".

If you did not get a zip, ask for one. The alternative is downloading it from
GitHub yourself: go to
<https://github.com/JasonLayel/JLTest/archive/refs/heads/ccr-52eee7cf-dyvxb5.zip>,
which downloads the whole repo, and the `hearth` folder is inside it.

**Getting later updates.** A zip is a snapshot. When changes are made, you
need a fresh copy. Easiest long-term fix is **GitHub Desktop**
(<https://desktop.github.com>), a normal Windows program: install it once,
sign in, clone `JasonLayel/JLTest`, and after that getting updates is clicking
**Fetch origin** then **Pull**. No terminal. Worth doing if this project keeps
moving, but not required today.

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

## 4. Connect and deploy

**Double-click `First Time Setup.bat`**, in the same `hearth` folder as this
file. No terminal, no typing paths.

A black window opens and walks through the rest: installing the Firebase tool,
signing you in to Google, picking your project, taking your Anthropic API key,
and deploying. It stops and tells you what is about to happen before each part,
and waits for you to press a key.

Have these ready before you start it:

- **Your Anthropic API key.** Get it at <https://console.anthropic.com>, under
  API keys. Copy it to the clipboard.
- Steps 1 to 3 above finished.

Three things it will ask you, so they are not a surprise:

| It says | You do |
| --- | --- |
| A browser opens asking you to sign in | Pick the Google account your Firebase project is on, and allow access |
| A list of projects appears | Arrow keys to yours, Enter. When it asks for an alias, type `default` |
| Notepad opens, empty | Paste your key with **Ctrl+V**, save with **Ctrl+S**, close it. The window carries on by itself |

When it finishes it prints a **Hosting URL** like
`https://hearth-companion-4f2a1.web.app`. That is the app. The window stays
open so you can read it.

**If it sits on "Installing the Firebase tool" with nothing happening:** that
is normal. It downloads several hundred packages and can take 2 to 10 minutes.
To confirm it is alive, press **Ctrl + Shift + Esc** for Task Manager and look
for **Node.js: Server-side JavaScript** in the Processes list with non-zero CPU
or Network. Past 10 minutes with nothing, close the window and double-click the
file again. It keeps what it already downloaded, so the retry is faster.

**If the key step says "Secret Payload cannot be empty":** the key never
arrived. **Ctrl+V does not paste into a black console window** on Windows,
which is why the setup now uses Notepad for this step instead. Make sure you
are on the current `First Time Setup.bat`. In Notepad, you must press
**Ctrl+S** before closing: closing without saving leaves the file empty and
produces exactly this error.

**If it says "That did not look like an Anthropic key":** Anthropic keys start
with `sk-ant-`. You probably copied a partial selection, or copied it with
quotation marks around it.

**If it says "Invalid project id: REPLACE-WITH-YOUR-PROJECT-ID":** you have an
old copy. Delete the file named `.firebaserc` from the `hearth` folder and run
the setup again. That file ships as a placeholder, and the Firebase tool reads
it before running any command, so an unfilled placeholder blocks everything
including signing in. Current versions clear it automatically.

**If the window says Node.js is not installed:** go to <https://nodejs.org>,
click the big green **LTS** button, install it accepting every default, then
double-click `First Time Setup.bat` again.

**If a step fails**, the window tells you which one and what usually causes it,
and stays open. The troubleshooting section at the bottom of this file has the
rest.

**While you are in the Anthropic console, set a spend limit.** Billing, then
limits. That is the real cap on what this can cost you. Everything in the code
is a seatbelt, not a budget.

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

Double-click **`Deploy Hearth.bat`** whenever you want to push changes. Same
deploy as step 4, keeps the window open so you can read what happened.

Which file is which:

| File | When |
| --- | --- |
| `First Time Setup.bat` | Once, ever. Installs and connects everything |
| `Deploy Hearth.bat` | Every time you want to push a change |

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


---

## Appendix: doing step 4 by hand

You should not need this. `First Time Setup.bat` does all of it. It is here in
case the launcher fails and you want to run the pieces yourself.

**To get a command prompt open in the `hearth` folder:** open the folder in
File Explorer, click once in the address bar at the top so the path highlights,
type `cmd` over it, and press Enter. A black window opens already pointed at
that folder. (On Windows 11 you can also right-click empty space in the folder
and choose **Open in Terminal**.)

Then, one line at a time:

```
npm install -g firebase-tools
firebase login
firebase use --add
firebase functions:secrets:set ANTHROPIC_API_KEY
firebase deploy --only functions,hosting
```

`firebase use --add` shows a list: arrow to your project, press Enter, and type
`default` when it asks for an alias. The secrets command hides what you paste.
