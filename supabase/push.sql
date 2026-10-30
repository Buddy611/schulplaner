-- =====================================================================
-- Benachrichtigungen: einmal im Supabase "SQL Editor" ausführen.
-- Vorher (einmalig) im SQL Editor die beiden Geheimnisse anlegen –
-- die genauen Werte bekommst du von Claude, sie gehören NICHT ins Repository:
--   select vault.create_secret('<Projekt-URL>', 'project_url');
--   select vault.create_secret('<Cron-Geheimnis>', 'cron_secret');
-- =====================================================================

-- ---------- Push-Anmeldungen der Geräte ----------
create table if not exists public.push_subscriptions (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint   text        not null primary key,
  p256dh     text        not null,
  auth       text        not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;
revoke all on public.push_subscriptions from anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;

drop policy if exists "push_own" on public.push_subscriptions;
create policy "push_own" on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------- Protokoll: welche Erinnerung wurde schon geschickt ----------
-- Nur die Edge Function (mit Server-Schlüssel) schreibt hier; normale Nutzer haben keinen Zugriff.
create table if not exists public.reminder_log (
  user_id uuid not null references auth.users (id) on delete cascade,
  key     text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.reminder_log enable row level security;
alter table public.reminder_log force row level security;
revoke all on public.reminder_log from anon, authenticated;

-- ---------- Zeitplan: alle 15 Minuten die Edge Function aufrufen ----------
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('send-reminders') where exists (select 1 from cron.job where jobname = 'send-reminders');

select cron.schedule(
  'send-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
