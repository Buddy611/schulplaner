-- =====================================================================
-- Schulplaner – Datenbank-Einrichtung
-- Einmal komplett im Supabase "SQL Editor" ausführen (Run).
-- Kann gefahrlos mehrfach ausgeführt werden.
-- =====================================================================

-- ---------- Tabelle für alle Daten ----------
-- Jeder Eintrag (Fach, Hausaufgabe, Note, ...) ist eine Zeile.
-- "collection" sagt, um welche Art von Eintrag es sich handelt, "data" enthält die Felder.
create table if not exists public.records (
  user_id           uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  id                text        not null,
  collection        text        not null,
  data              jsonb       not null default '{}'::jsonb,
  deleted           boolean     not null default false,
  updated_at        bigint      not null,               -- Änderungszeit vom Gerät (ms) → "neueste gewinnt"
  server_updated_at timestamptz not null default now(),  -- wann der Server die Zeile zuletzt geändert hat
  primary key (user_id, id)
);

create index if not exists records_user_server_updated_idx
  on public.records (user_id, server_updated_at);

-- ---------- Konfliktlösung: neueste Änderung gewinnt ----------
create or replace function public.records_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Ältere Änderung (z. B. von einem Gerät, das lange offline war) überschreibt keine neuere.
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null;
  end if;
  -- Besitzer darf nie geändert werden.
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists records_before_write on public.records;
create trigger records_before_write
  before insert or update on public.records
  for each row execute function public.records_before_write();

-- ---------- Row Level Security: nur eigene Daten ----------
alter table public.records enable row level security;
alter table public.records force row level security;

-- Nicht angemeldete Besucher (anon) bekommen überhaupt keinen Zugriff.
revoke all on public.records from anon;
grant select, insert, update, delete on public.records to authenticated;

drop policy if exists "records_select_own" on public.records;
drop policy if exists "records_insert_own" on public.records;
drop policy if exists "records_update_own" on public.records;
drop policy if exists "records_delete_own" on public.records;

create policy "records_select_own" on public.records
  for select to authenticated using (user_id = (select auth.uid()));
create policy "records_insert_own" on public.records
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "records_update_own" on public.records
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "records_delete_own" on public.records
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- Privater Datei-Speicher für Fotos & Dokumente ----------
-- Dateien liegen unter "<user_id>/<datei_id>" – jeder sieht nur seinen eigenen Ordner.
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 52428800)  -- max. 50 MB pro Datei
on conflict (id) do update set public = false;

drop policy if exists "attachments_select_own" on storage.objects;
drop policy if exists "attachments_insert_own" on storage.objects;
drop policy if exists "attachments_update_own" on storage.objects;
drop policy if exists "attachments_delete_own" on storage.objects;

create policy "attachments_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "attachments_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "attachments_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "attachments_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = (select auth.uid())::text);
