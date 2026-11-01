# Schulplaner – Guide

Private school planner app (PWA): runs in the browser, can be added to the home screen
on iPhone, iPad and Android, and works fully offline.

The app itself is in German, so button and menu names are quoted in German below.

## Install on your device

- **iPhone/iPad:** open the address in **Safari** → Share icon → "Add to Home Screen".
- **Android:** open the address in **Chrome** → menu (⋮) → "Install app".
- After that, always open it from the icon on the home screen.

## How offline works

- All data is stored on the device and is read and written there.
- Changes go into a queue and are synced as soon as there is internet
  (on conflicts, the newest change wins).
- The top right shows „Offline" or „x ausstehend" (x pending) while something is not synced yet.
- School holidays are stored two school years in advance.
- New app versions are loaded automatically as soon as there is internet.

## Offline test (airplane mode)

1. Open the app once with internet (so everything is stored).
2. Turn on airplane mode, close the app completely and open it again → it starts normally and you are signed in.
3. Add something → the top shows „Offline · 1 ausstehend".
4. Turn off airplane mode → after a few seconds the notice is gone and the change is on your other devices.

## Notifications

- Settings („Einstellungen") → Notifications („Benachrichtigungen") → turn on „Auf diesem Gerät empfangen" (receive on this device).
- iPhone/iPad: only in the app opened from the home screen (iOS 16.4 or later).
- Reminders are sent by the Supabase Edge Function `send-reminders`
  (every 15 minutes on a schedule, see `supabase/push.sql`). The device needs internet
  at the set time, otherwise the message arrives later.

---

# Set up your own copy

This is the full setup, step by step: from an empty Supabase project to the app running
on GitHub Pages. You need a free **GitHub** account, a free **Supabase** account,
**Git** and **Node.js 24** (only for running it on your computer).

> Supabase and GitHub sometimes move menu items around. If a menu has a slightly
> different name, look for the closest match.

## Overview: what goes where

| Value | Where you get it | Where you enter it |
|---|---|---|
| Project URL (`https://xxxx.supabase.co`) | Supabase → Project Settings → Data API (or the "Connect" button) | `.env.local` and GitHub variable `VITE_SUPABASE_URL` |
| Publishable key (`sb_publishable_…`) | Supabase → Project Settings → API Keys | `.env.local` and GitHub variable `VITE_SUPABASE_KEY` |
| VAPID public key | you generate it (step 6) | `.env.local`, GitHub variable `VITE_VAPID_PUBLIC_KEY` **and** Supabase secret `VAPID_PUBLIC_KEY` |
| VAPID private key | you generate it (step 6) | **only** Supabase secret `VAPID_PRIVATE_KEY` |
| Cron secret (any long random text) | you make it up (step 6) | Supabase secret `CRON_SECRET` **and** Supabase Vault `cron_secret` |
| Project ID (`xxxx` from the project URL) | Supabase → Project Settings → General | only in the commands in step 6 |

**Never** put the secret / service-role key, the VAPID private key or the cron secret
into the app, into `.env.local` or into the repository. The publishable key and the
VAPID public key are meant to be public.

## 1. Get the code

Fork the repository on GitHub (or create your own repository and push the code there),
then clone it:

```bash
git clone https://github.com/<your-name>/schulplaner.git
cd schulplaner
npm install
```

The app expects to live at `https://<your-name>.github.io/schulplaner/`.
If your repository has a different name, change `base` in `vite.config.ts` to `/<repo-name>/`.

## 2. Create the Supabase project

1. Go to supabase.com → **New project**.
2. Pick a name, a strong database password (save it somewhere safe, e.g. a password manager)
   and a region close to you.
3. Wait until the project is ready.

## 3. Create the database

Open **SQL Editor** in Supabase, paste the whole file, click **Run**. Do this for:

1. `supabase/schema.sql` – the data table, Row Level Security (only your own data)
   and the private file storage `attachments` for photos and PDFs.
2. `supabase/keepalive.sql` – a tiny function so the free project doesn't get paused
   after 7 days without use (called by `.github/workflows/keepalive.yml` every 3 days).

Both files can safely be run again.

## 4. Sign-in: turn off sign-ups and create your account

1. **Authentication → Sign In / Providers** → turn **off** "Allow new users to sign up".
   Nobody else can create an account then.
2. **Authentication → Users → Add user → Create new user**: enter your e-mail and a password,
   tick **"Auto Confirm User"**, save.

You sign in to the app with exactly this e-mail and password.

## 5. Run it on your computer

1. Copy `.env.example` to `.env.local` (this file is ignored by Git and never uploaded).
2. Fill in the Project URL and the publishable key (see the table above).
   `VITE_VAPID_PUBLIC_KEY` can stay empty for now.
3. Start it:

```bash
npm run dev
```

4. Open the address Vite shows (e.g. `http://localhost:5173/schulplaner/`) and sign in.

## 6. Notifications (optional)

Skip this step if you don't need reminders. The app works without it.

**a) Make the keys.** Generate a VAPID key pair:

```bash
npx web-push generate-vapid-keys
```

Also make up a cron secret: any long random text (e.g. 40 random letters and digits).

**b) Put the server secrets into Supabase.** Create a file `.env.secrets` in the project
folder (ignored by Git) with:

```
VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>
CRON_SECRET=<cron secret>
VAPID_SUBJECT=mailto:<an e-mail address for the push services>
```

`VAPID_SUBJECT` is optional. Then log in to the Supabase command line tool once and upload
the secrets and the function (on Windows PowerShell use `npx.cmd` instead of `npx`):

```bash
npx supabase@2 login
```

```bash
npx supabase@2 secrets set --project-ref <PROJECT-ID> --env-file .env.secrets
```

```bash
npx supabase@2 functions deploy send-reminders --project-ref <PROJECT-ID> --no-verify-jwt
```

Delete `.env.secrets` afterwards, or keep it only on your computer.

**c) Start the schedule.** In the Supabase **SQL Editor**, first store two values in the Vault
(run once, with your real values):

```sql
select vault.create_secret('https://<PROJECT-ID>.supabase.co', 'project_url');
select vault.create_secret('<cron secret>', 'cron_secret');
```

Then run `supabase/push.sql`. It creates the tables for push subscriptions and
calls the function every 15 minutes.

**d) Tell the app the public key.** Put the VAPID public key into `VITE_VAPID_PUBLIC_KEY`
in `.env.local` and into the GitHub variable of the same name (step 7).

## 7. Publish on GitHub Pages

1. In your repository on GitHub: **Settings → Pages → Build and deployment → Source:
   "GitHub Actions"**.
2. **Settings → Secrets and variables → Actions → tab "Variables" → New repository variable**.
   Create these three (use **Variables**, not Secrets – the values are public anyway):
   - `VITE_SUPABASE_URL` – Project URL
   - `VITE_SUPABASE_KEY` – publishable key
   - `VITE_VAPID_PUBLIC_KEY` – VAPID public key (leave out if you skipped step 6)
3. Push to `main`, or start it by hand: **Actions → "Veröffentlichen auf GitHub Pages" → Run workflow**.
4. After 1–2 minutes the app is at `https://<your-name>.github.io/schulplaner/`.

From now on, every push to `main` builds and publishes the app automatically.
The "Supabase wach halten" workflow (keepalive) uses the same variables and runs on its own.

## 8. Install it on your phone

Open the address from step 7 on your phone and add it to the home screen
(see "Install on your device" above). Sign in once with internet.

## Security

- The code only contains the public publishable key; it comes from the GitHub variables
  when publishing. Never put the secret / service-role key in the app or the repository!
- Every row in the database belongs to one user (`user_id`); Row Level Security only allows
  access to your own data. Nothing can be read without signing in.
- Photos and documents are stored in the private bucket `attachments`, in the user's folder.
- The published app has a Content Security Policy: it may only talk to your Supabase
  project and the holiday API (openholidaysapi.org).
