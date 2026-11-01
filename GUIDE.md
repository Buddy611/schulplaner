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

## Set up Supabase (one time, already done)

Run these one after another in the Supabase **SQL Editor**:

1. `supabase/schema.sql` – table, security rules (Row Level Security), private file storage
2. `supabase/keepalive.sql` – keeps the free project from being paused
3. Create two secrets in the Vault (never put the values in the repository!), then run `supabase/push.sql`

Deploy the Edge Function:

```
npx.cmd supabase@2 secrets set --project-ref <PROJECT-ID> --env-file <file with VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET>
npx.cmd supabase@2 functions deploy send-reminders --project-ref <PROJECT-ID> --no-verify-jwt
```

New sign-ups are turned off (Authentication → Sign In / Providers →
"Allow new users to sign up" off). New accounts are created under Authentication → Users →
"Add user" (with "Auto Confirm User").

## Security

- The code only contains the public publishable key; it comes from the GitHub variables
  when publishing. Never put the secret / service-role key in the app or the repository!
- Every row in the database belongs to one user (`user_id`); Row Level Security only allows
  access to your own data. Nothing can be read without signing in.
- Photos and documents are stored in the private bucket `attachments`, in the user's folder.

## Publishing

Every push to `main` builds the app with GitHub Actions and publishes it on GitHub Pages.
Required repository variables (Settings → Secrets and variables → Actions → Variables):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`, `VITE_VAPID_PUBLIC_KEY`.
