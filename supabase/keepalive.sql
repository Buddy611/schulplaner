-- =====================================================================
-- Keepalive: verhindert, dass Supabase das kostenlose Projekt nach
-- 7 Tagen ohne Nutzung pausiert. Ein GitHub-Auftrag ruft diese Funktion
-- alle 3 Tage auf (.github/workflows/keepalive.yml).
-- Die Funktion gibt nur die aktuelle Uhrzeit zurück – keine Daten.
-- Einmal im Supabase "SQL Editor" ausführen.
-- =====================================================================
create or replace function public.keepalive()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select now();
$$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
