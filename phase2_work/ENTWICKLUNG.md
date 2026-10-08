# Klar lokal starten

Ein Befehl, alles läuft:

```bash
npm run dev:lokal
```

Das startet Auth-Emulator, Firestore-Emulator, den Express-Server und Vite —
in einem Prozess, mit einer Datenbank, die beim Beenden verschwindet.

| Port | Was |
|:--|:--|
| **3000** | **Klar.** Hier arbeiten Sie. |
| 4000 | Emulator-Oberfläche — hier sehen Sie Konten und Dokumente in Echtzeit |
| 9099 | Auth-Emulator |
| 8080 | Firestore-Emulator |

Beenden mit `Strg + C`. **Alle Daten sind dann weg** — das ist die Absicht.

---

## Warum es das braucht

Der Server rief `initializeApp()` ohne Zugangsdaten. Firebase Admin sucht
dann nach *Application Default Credentials*; im Codespace gibt es keine, also
scheiterte jeder Firestore-Zugriff.

Seit der Altersprüfung (DSG-02) ist das **sperrend**: Ohne Schreibzugriff
lässt sich `isAdult` nicht setzen, das Gate öffnet nie, und kein einziger
KI-Endpunkt ist erreichbar. Die App war damit lokal nicht mehr benutzbar.

Der Emulator löst das ohne Zugangsdaten, ohne Kosten und ohne echte Daten.

**Projekt-ID ist `demo-klar`**, nicht die echte. Bei dieser Schreibweise
verlangt die Firebase-CLI keine Anmeldung und kann garantiert nie mit der
Produktionsdatenbank sprechen. Dieselbe ID benutzen die Regeltests.

---

## Der erste Durchlauf

**1. Registrieren.** „Mit E-Mail anmelden" → „Noch kein Konto? Hier
registrieren". Beliebige Adresse, beliebiges Passwort ab 6 Zeichen — der
Emulator verschickt nichts und prüft nichts.

**2. Alter angeben.** Ein Datum, das mindestens 18 Jahre zurückliegt. Ein
jüngeres wird abgelehnt; der Versuch landet in `age_attempts` — auf Port 4000
können Sie ihm zusehen.

**3. Einwilligung.** Für den KI-Coach muss **„KI-Auswertung"** angehakt sein.
Ohne sie antworten alle 53 KI-Endpunkte mit `403 einwilligung_fehlt` — das
ist keine Störung, sondern die Umsetzung von DSG-02.

**4. Dashboard.** Ab hier ist die App offen.

---

## Was auch lokal nicht funktioniert

| | Warum |
|:--|:--|
| **KI-Coach ohne Schlüssel** | Für Gemini gibt es keinen Emulator. `GEMINI_API_KEY` in `.env.local` eintragen, sonst antworten die KI-Endpunkte mit einem Fehler. Alles andere läuft. |
| **Google-Anmeldung** | Der Auth-Emulator kann OAuth nur nachspielen. E-Mail und Passwort sind der verlässliche Weg. |
| **Verifizierung (K-1)** | Braucht ein Konto mit Moderator-Anspruch — siehe unten. |
| **Bezahlung, AdMob** | Nicht angebunden. `/api/subscribe-klar-plus` antwortet mit 501, der AdMob-Weg braucht einen echten signierten Rückruf. |

### Moderator werden

Verifizierungen freizugeben verlangt den Anspruch `moderator: true`. Bei
laufendem `dev:lokal`, in einem **zweiten** Terminal:

```bash
node scripts/dev-moderator.mjs deine@mail.de
```

Danach in der App **abmelden und neu anmelden** — Ansprüche stehen im Token,
und das wird erst bei der nächsten Anmeldung neu ausgestellt.

Das Skript bricht ab, wenn die Projekt-ID nicht mit `demo-` beginnt. Es kann
die echte Anmeldung also nicht anfassen.

---

## Wenn etwas nicht startet

| Meldung | Grund |
|:--|:--|
| `Port 8080 is not open` | Ein Emulator von vorhin läuft noch: `pkill -f "firebase.*emulator"` |
| `EADDRINUSE :3000` | Ein alter Dev-Server: `pkill -f "tsx server.ts"` |
| `java: command not found` | Die Emulatoren sind Java-Anwendungen. Im Devcontainer ist Java 17 eingerichtet; lokal ggf. nachinstallieren. |
| `WARNUNG: Weder Emulator noch Projekt-ID` | Sie haben `npm run dev` statt `npm run dev:lokal` gestartet. Ohne Emulator scheitert jeder Datenbankzugriff. |

---

## Gegen das echte Projekt

Nur, wenn es sein muss — etwa zum Prüfen der ausgerollten Regeln:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/pfad/zum/dienstkonto.json
npm run dev
```

Dann schreiben Sie in die **echte** Datenbank. Der Emulator-Hinweis in der
Browserkonsole fehlt in diesem Fall — das ist der Unterschied, auf den zu
achten ist.
