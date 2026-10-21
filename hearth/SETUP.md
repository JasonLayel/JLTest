# Setting up Hearth

Everything here happens in a **web browser**. Nothing is installed on your PC,
nothing is downloaded, and there is no terminal.

Deploys run on GitHub's computers, not yours. That also means when something
breaks, Claude can read the failure log directly and fix it, instead of you
running an installer again and reporting back.

If you already did steps 1 to 3 on a previous attempt, skip to step 4.

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

## 4. Give GitHub permission to deploy

GitHub needs a credential for your Firebase project. This is the same kind of
thing you already have set up for the Petulant Princess app.

1. Open <https://console.firebase.google.com> and pick **hearth-companion**.
2. Click the **gear icon** next to Project Overview, then **Project settings**.
3. Open the **Service accounts** tab.
4. Click **Generate new private key**, then **Generate key** to confirm.
5. A `.json` file downloads. Open it in Notepad and **select all, copy**. You
   want the whole contents, braces included.

Now put it into GitHub:

6. Go to <https://github.com/JasonLayel/JLTest> and make sure you are
   **signed in as JasonLayel**. Look at the top right: if you see a **Sign in**
   button instead of your avatar, sign in first. Settings pages return a 404
   when you are signed out, which looks like a broken link but is not.
7. Click the **Settings** tab, along the top of the repository, to the right of
   Insights. If the tabs are collapsed into a **...** dropdown because the
   window is narrow, it is in there.
8. In the left sidebar, under the **Security** heading, click
   **Secrets and variables**, then **Actions**.
9. Make sure you are on the **Secrets** tab, not Variables.
10. Click **New repository secret**.
11. Name: `HEARTH_SERVICE_ACCOUNT`
12. Secret: paste the whole JSON.
13. Click **Add secret**.

Then add your Anthropic key the same way:

14. Click **New repository secret** again.
15. Name: `ANTHROPIC_API_KEY`
16. Secret: paste your key. It starts with `sk-ant-`.
17. Click **Add secret**.

You should now see both names listed. GitHub hides the values, which is
correct. **Delete the downloaded `.json` file** from your Downloads folder
once it is pasted.

## 5. Store the key and deploy

Two buttons, both on GitHub.

1. Go to <https://github.com/JasonLayel/JLTest/actions/workflows/hearth-set-key.yml>
2. Click **Run workflow**, pick the branch `ccr-52eee7cf-dyvxb5`, click the
   green **Run workflow** button.
3. Wait about a minute. Refresh. A **green tick** means the key is stored. A
   **red X** means something is wrong: click into it, and send Claude what it
   says.

Then:

4. Go to <https://github.com/JasonLayel/JLTest/actions/workflows/hearth-deploy.yml>
5. **Run workflow** the same way, same branch.
6. This one takes a few minutes. Green tick means it is live.

From now on this runs automatically whenever the Hearth code changes. You do
not have to come back here.

## 6. Open it

Your app is at **<https://hearth-companion.web.app>**

On your phone, open that address in Chrome, then use the menu and **Add to
Home screen** so it behaves like an app.

## 7. Check the voice

In the app, go to **Settings**, then **Run voice check**.

It fires five situations at the companion and shows what comes back, including
you saying a drawing looks awful and you calling yourself lazy. Read the
replies. If the voice is wrong, that is worth fixing now rather than after a
month of sessions.

## 8. Turn on sync

1. On the PC, in **Settings**, type a phrase into the sync box. Eight
   characters or more, something like `drawing-afternoons`. Click **Save**.
2. On the phone, same app, Settings, type the **same phrase**, Save.

The phone pulls down whatever the PC has. That phrase is the only key to your
data, so do not make it `password`.

---

## If something goes wrong

**The Settings tab is missing, or a settings link gives a 404.** You are not
signed in to GitHub, or you are signed in as a different account. GitHub hides
settings pages behind a 404 rather than an access-denied message. Sign in as
**JasonLayel** and try again.

**A workflow shows a red X.** Click the run, then the failed step, to see the
log. Send it to Claude. This is the main reason the deploy was moved to
GitHub: the log is readable without you doing anything.

**The deploy fails with a 403, or names a missing permission.** The
service account needs roles it does not get by default. The simplest fix, and
the one that ends this in a single pass:

1. Open <https://console.cloud.google.com/iam-admin/iam?project=hearth-companion>
   Use that link rather than the project picker, which shows only recent
   projects and may be on a different Google account.
2. Find the row whose principal contains **firebase-adminsdk**.
3. Click the **pencil** at the right of that row.
4. **Add another role**, choose **Owner**.
5. **Save**.

Owner is broader than necessary. It is recommended here because granting
roles one error at a time costs a failed deploy each round, and this is a
personal project whose credential lives only in this repository's Actions
secrets, which are not readable by forks.

If you would rather keep it tight, the roles actually required are **Editor**,
**Secret Manager Admin**, **Service Account User**, **Cloud Functions Admin**
and, for second generation functions, **Cloud Run Admin**. Expect to discover
any you miss one deploy at a time.

Grants take a minute to apply.

**Settings in the app says sync is unavailable.** Firestore is not created, or
is not the `(default)` database. Go back to step 3.

**The companion never answers but the app works.** The key is not stored.
Re-run the **Set Hearth API key** workflow and check it goes green.

**The voice check says it could not reach the companion.** The deploy has not
finished, or it failed. Check the Actions tab.

---

## Appendix: deploying from your own PC

You do not need this. It is here only if GitHub is unavailable.

`First Time Setup.bat` and `Deploy Hearth.bat` in the `hearth` folder do the
same job locally. They need Node.js installed and they will ask you to sign in
to Google. They have been the source of most of the friction in this project,
because they cannot be tested anywhere except on your machine.
