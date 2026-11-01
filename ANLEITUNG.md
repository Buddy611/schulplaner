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

---

# Eigene Kopie einrichten

Die komplette Einrichtung Schritt für Schritt: vom leeren Supabase-Projekt bis zur fertigen
App auf GitHub Pages. Du brauchst ein kostenloses **GitHub**-Konto, ein kostenloses
**Supabase**-Konto, **Git** und **Node.js 24** (nur zum Starten auf dem eigenen Computer).

> Supabase und GitHub verschieben manchmal Menüpunkte. Wenn ein Menü etwas anders heißt,
> nimm den Punkt, der am besten passt.

## Überblick: was kommt wohin

| Wert | Woher | Wohin |
|---|---|---|
| Projekt-URL (`https://xxxx.supabase.co`) | Supabase → Project Settings → Data API (oder Knopf „Connect“) | `.env.local` und GitHub-Variable `VITE_SUPABASE_URL` |
| Publishable Key (`sb_publishable_…`) | Supabase → Project Settings → API Keys | `.env.local` und GitHub-Variable `VITE_SUPABASE_KEY` |
| Öffentlicher VAPID-Schlüssel | erzeugst du selbst (Schritt 6) | `.env.local`, GitHub-Variable `VITE_VAPID_PUBLIC_KEY` **und** Supabase-Secret `VAPID_PUBLIC_KEY` |
| Privater VAPID-Schlüssel | erzeugst du selbst (Schritt 6) | **nur** Supabase-Secret `VAPID_PRIVATE_KEY` |
| Cron-Geheimnis (beliebiger langer Zufallstext) | denkst du dir aus (Schritt 6) | Supabase-Secret `CRON_SECRET` **und** Supabase-Vault `cron_secret` |
| Projekt-ID (`xxxx` aus der Projekt-URL) | Supabase → Project Settings → General | nur in den Befehlen in Schritt 6 |

**Niemals** den Secret-/Service-Role-Key, den privaten VAPID-Schlüssel oder das Cron-Geheimnis
in die App, in `.env.local` oder ins Repository schreiben. Der Publishable Key und der
öffentliche VAPID-Schlüssel dürfen öffentlich sein.

## 1. Code holen

Repository auf GitHub forken (oder ein eigenes Repository anlegen und den Code hochladen),
dann herunterladen:

```bash
git clone https://github.com/<dein-name>/schulplaner.git
cd schulplaner
npm install
```

Die App erwartet die Adresse `https://<dein-name>.github.io/schulplaner/`.
Heißt dein Repository anders, ändere `base` in `vite.config.ts` auf `/<repo-name>/`.

## 2. Supabase-Projekt anlegen

1. Auf supabase.com → **New project**.
2. Namen, ein starkes Datenbank-Passwort (sicher aufbewahren, z. B. im Passwort-Manager)
   und eine Region in deiner Nähe wählen.
3. Warten, bis das Projekt fertig ist.

## 3. Datenbank einrichten

In Supabase den **SQL Editor** öffnen, die ganze Datei einfügen, **Run** klicken. Für:

1. `supabase/schema.sql` – Datentabelle, Row Level Security (nur eigene Daten)
   und der private Datei-Speicher `attachments` für Fotos und PDFs.
2. `supabase/keepalive.sql` – kleine Funktion, damit das kostenlose Projekt nicht nach
   7 Tagen ohne Nutzung pausiert (wird von `.github/workflows/keepalive.yml` alle 3 Tage aufgerufen).

Beide Dateien kann man gefahrlos mehrmals ausführen.

## 4. Anmeldung: Registrierung aus, eigenes Konto anlegen

1. **Authentication → Sign In / Providers** → „Allow new users to sign up“ **aus**.
   Dann kann sich niemand sonst ein Konto anlegen.
2. **Authentication → Users → Add user → Create new user**: E-Mail und Passwort eintragen,
   **„Auto Confirm User“** anhaken, speichern.

Mit genau dieser E-Mail und diesem Passwort meldest du dich in der App an.

## 5. Auf dem eigenen Computer starten

1. `.env.example` nach `.env.local` kopieren (diese Datei ignoriert Git, sie wird nie hochgeladen).
2. Projekt-URL und Publishable Key eintragen (siehe Tabelle oben).
   `VITE_VAPID_PUBLIC_KEY` darf erst mal leer bleiben.
3. Starten:

```bash
npm run dev
```

4. Die Adresse öffnen, die Vite anzeigt (z. B. `http://localhost:5173/schulplaner/`), und anmelden.

## 6. Benachrichtigungen (optional)

Wer keine Erinnerungen braucht, überspringt diesen Schritt. Die App läuft auch ohne.

**a) Schlüssel erzeugen.** Ein VAPID-Schlüsselpaar erzeugen:

```bash
npx web-push generate-vapid-keys
```

Dazu ein Cron-Geheimnis ausdenken: ein langer Zufallstext (z. B. 40 zufällige Buchstaben und Ziffern).

**b) Server-Geheimnisse in Supabase speichern.** Im Projektordner eine Datei `.env.secrets`
anlegen (Git ignoriert sie) mit:

```
VAPID_PUBLIC_KEY=<öffentlicher Schlüssel>
VAPID_PRIVATE_KEY=<privater Schlüssel>
CRON_SECRET=<Cron-Geheimnis>
VAPID_SUBJECT=mailto:<eine E-Mail-Adresse für die Push-Dienste>
```

`VAPID_SUBJECT` ist freiwillig. Dann einmal beim Supabase-Kommandozeilenwerkzeug anmelden und
Geheimnisse und Funktion hochladen (in Windows PowerShell `npx.cmd` statt `npx`):

```bash
npx supabase@2 login
```

```bash
npx supabase@2 secrets set --project-ref <PROJEKT-ID> --env-file .env.secrets
```

```bash
npx supabase@2 functions deploy send-reminders --project-ref <PROJEKT-ID> --no-verify-jwt
```

`.env.secrets` danach löschen oder nur auf deinem Computer behalten.

**c) Zeitplan starten.** Im Supabase **SQL Editor** zuerst zwei Werte im Vault speichern
(einmalig, mit deinen echten Werten):

```sql
select vault.create_secret('https://<PROJEKT-ID>.supabase.co', 'project_url');
select vault.create_secret('<Cron-Geheimnis>', 'cron_secret');
```

Dann `supabase/push.sql` ausführen. Das legt die Tabellen für die Push-Anmeldungen an und
ruft die Funktion alle 15 Minuten auf.

**d) Der App den öffentlichen Schlüssel geben.** Den öffentlichen VAPID-Schlüssel in
`VITE_VAPID_PUBLIC_KEY` in `.env.local` und in die gleichnamige GitHub-Variable (Schritt 7) eintragen.

## 7. Auf GitHub Pages veröffentlichen

1. In deinem Repository auf GitHub: **Settings → Pages → Build and deployment → Source:
   „GitHub Actions“**.
2. **Settings → Secrets and variables → Actions → Reiter „Variables“ → New repository variable**.
   Diese drei anlegen (unter **Variables**, nicht Secrets – die Werte sind sowieso öffentlich):
   - `VITE_SUPABASE_URL` – Projekt-URL
   - `VITE_SUPABASE_KEY` – Publishable Key
   - `VITE_VAPID_PUBLIC_KEY` – öffentlicher VAPID-Schlüssel (weglassen, wenn du Schritt 6 übersprungen hast)
3. Auf `main` pushen oder von Hand starten: **Actions → „Veröffentlichen auf GitHub Pages“ → Run workflow**.
4. Nach 1–2 Minuten läuft die App unter `https://<dein-name>.github.io/schulplaner/`.

Ab jetzt baut und veröffentlicht jeder Push auf `main` die App automatisch.
Der Auftrag „Supabase wach halten“ (Keepalive) nutzt dieselben Variablen und läuft von selbst.

## 8. Aufs Handy holen

Die Adresse aus Schritt 7 auf dem Handy öffnen und zum Home-Bildschirm hinzufügen
(siehe „Auf dem Gerät installieren“ oben). Einmal mit Internet anmelden.

## Sicherheit

- Im Code steht nur der öffentliche Publishable Key; er kommt beim Veröffentlichen aus
  den GitHub-Variablen. Den Secret/Service-Role-Key nie in die App oder ins Repository!
- Jede Zeile in der Datenbank gehört einem Nutzer (`user_id`), Row Level Security erlaubt
  nur Zugriff auf eigene Daten. Ohne Login ist nichts abrufbar.
- Fotos/Dokumente liegen im privaten Bucket `attachments` im Ordner des Nutzers.
- Die veröffentlichte App hat eine Content Security Policy: Sie darf nur mit deinem
  Supabase-Projekt und der Ferien-Schnittstelle (openholidaysapi.org) sprechen.
