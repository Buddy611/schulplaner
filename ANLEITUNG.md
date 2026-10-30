# Schulplaner – Anleitung

Private Schulplaner-App (PWA): läuft im Browser, lässt sich auf iPhone, iPad und Android
zum Home-Bildschirm hinzufügen und funktioniert komplett offline.

## Auf dem Gerät installieren

- **iPhone/iPad:** Adresse in **Safari** öffnen → Teilen-Symbol → „Zum Home-Bildschirm“.
- **Android:** Adresse in **Chrome** öffnen → Menü (⋮) → „App installieren“.
- Danach immer über das Symbol auf dem Home-Bildschirm öffnen.

## So funktioniert offline

- Alle Daten liegen auf dem Gerät und werden von dort gelesen und geschrieben.
- Änderungen kommen in eine Warteschlange und werden abgeglichen, sobald Internet da ist
  (bei Konflikten gewinnt die neueste Änderung).
- Oben rechts steht „Offline“ bzw. „x ausstehend“, solange etwas noch nicht abgeglichen ist.
- Ferien werden für zwei Schuljahre im Voraus gespeichert.
- Neue App-Versionen werden automatisch geladen, sobald Internet da ist.

## Offline-Test (Flugmodus)

1. App einmal mit Internet öffnen (damit alles gespeichert ist).
2. Flugmodus an, App komplett schließen und neu öffnen → startet normal, du bist angemeldet.
3. Etwas eintragen → oben steht „Offline · 1 ausstehend“.
4. Flugmodus aus → nach wenigen Sekunden ist die Anzeige weg, die Änderung ist auf den anderen Geräten.

## Benachrichtigungen

- Einstellungen → Benachrichtigungen → „Auf diesem Gerät empfangen“ einschalten.
- iPhone/iPad: nur in der App vom Home-Bildschirm (ab iOS 16.4).
- Die Erinnerungen verschickt die Supabase Edge Function `send-reminders`
  (alle 15 Minuten per Zeitplan, siehe `supabase/push.sql`). Das Gerät braucht zur
  eingestellten Zeit Internet, sonst kommt die Nachricht später.

## Supabase einrichten (einmalig, schon erledigt)

Im Supabase **SQL Editor** nacheinander ausführen:

1. `supabase/schema.sql` – Tabelle, Sicherheitsregeln (Row Level Security), privater Datei-Speicher
2. `supabase/keepalive.sql` – verhindert, dass das kostenlose Projekt pausiert
3. Zwei Geheimnisse im Vault anlegen (Werte nicht ins Repository!), dann `supabase/push.sql`

Edge Function hochladen:

```
npx.cmd supabase@2 secrets set --project-ref <PROJEKT-ID> --env-file <Datei mit VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET>
npx.cmd supabase@2 functions deploy send-reminders --project-ref <PROJEKT-ID> --no-verify-jwt
```

Neue Registrierungen sind abgeschaltet (Authentication → Sign In / Providers →
„Allow new users to sign up“ aus). Neue Konten legt man unter Authentication → Users →
„Add user“ (mit „Auto Confirm User“) an.

## Sicherheit

- Im Code steht nur der öffentliche Publishable Key; er kommt beim Veröffentlichen aus
  den GitHub-Variablen. Den Secret/Service-Role-Key nie in die App oder ins Repository!
- Jede Zeile in der Datenbank gehört einem Nutzer (`user_id`), Row Level Security erlaubt
  nur Zugriff auf eigene Daten. Ohne Login ist nichts abrufbar.
- Fotos/Dokumente liegen im privaten Bucket `attachments` im Ordner des Nutzers.

## Veröffentlichen

Jeder Push auf `main` baut die App per GitHub Actions und veröffentlicht sie auf GitHub Pages.
Benötigte Repository-Variablen (Settings → Secrets and variables → Actions → Variables):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`, `VITE_VAPID_PUBLIC_KEY`.
