# Produktanalyse und Fotoverifizierung

Stand 27.09.2026, Prüfzweig PR 51. Maßgeblich sind Code, Tests und der [aktuelle Auditbericht](../AUDIT_2026-09-27.md).

## Tatsächlicher Datenfluss

Die Anwendung nutzt Express. `src/server/routes/analytics.ts` ist unter `/api/analytics/track` vor dem allgemeinen JSON-Parser eingebunden. Die Datei unter `app/routes/` ist nur ein Verweis; es läuft kein Remix-Server.

Produktanalyse ist ohne `ENABLE_FUNNEL_ANALYTICS=true` deaktiviert. Auch mit diesem Schalter sind Firebase-Authentifizierung und die gespeicherte, gültige Einwilligung `produktanalyse` erforderlich. Der Browserhelper sendet ohne ausdrücklichen Zustimmungsparameter nichts. Er verwendet `authFetch`, nicht `sendBeacon`, weil der Server einen geprüften Token verlangt. Eine flächendeckende Funnel-Instrumentierung ist noch nicht aktiviert.

Das Schema akzeptiert ausschließlich feste Ereignisnamen, einen begrenzten Sitzungsbezeichner, optional einen Zeitstempel und fest definierte Metadaten. Unbekannte Felder, Freitext und verschachtelte Nutzerdaten werden abgewiesen. Der Endpunkt akzeptiert maximal 10 KB und 30 Anfragen pro Minute und IP. Das IP-Limit gilt pro Serverprozess; vor horizontaler Aktivierung muss die verteilte Begrenzung nachgewiesen werden.

Gespeichert werden der serverseitige Kontobezug für Auskunft/Löschung, ein Hash des kontogebundenen Sitzungsbezeichners, ein Serverzeitstempel und ein Ablaufdatum. Das sind pseudonyme personenbezogene Daten. Die frühere Aussage „Zero PII“ war nicht zutreffend. Der tägliche Wartungsjob entfernt abgelaufene Datensätze begrenzt; große Rückstände benötigen Monitoring und gegebenenfalls einen freigegebenen Nachlauf.

## Fotoverifizierung

Es gibt keine konfigurierte automatische IDnow-/Didit- oder 3D-Liveness-Prüfung. Unkonfigurierte Adapter verweigern Erfolg. Der Client darf den Prüfstatus niemals selbst setzen.

Der aktive Weg fordert eine Geste an, nimmt ein Bild entgegen, speichert es privat in Storage und legt eine Prüfanforderung an. Eine berechtigte Moderation trifft die Entscheidung. Es werden also Rohbilder gespeichert; die frühere Behauptung, ausschließlich Hashes zu verarbeiten, war falsch. Die pauschale Gemini-Bilderkennung wurde aus diesem Weg entfernt.

Client-Lesen und Client-Löschen im Verifizierungspräfix bleiben verboten. Der Wartungsjob berücksichtigt ab 30 Tagen das Erstellungsdatum, schützt gleichzeitig ersetzte Objekte durch Generation-Präbedingungen und respektiert Storage-Holds. Die Kontolöschung entfernt die Foto-Präfixe beider Bildtypen. Fristbeginn, Beschwerden, Holds, Sicherungskopien und tatsächlicher Betrieb müssen vor Produktivfreigabe fachlich geprüft werden.

## Wartungsbetrieb

Cloud Functions liegen explizit in `europe-west3`. `FIRESTORE_DATABASE_ID` muss beim Functions-Deployment exakt auf dieselbe benannte Datenbank wie die API gesetzt werden. `KLAR_STORAGE_BUCKET` muss ebenfalls ausdrücklich den API-Bucket ohne `gs://` benennen. Ohne Werte wird kein stiller Zugriff auf Standardressourcen zugelassen. Bestehende Functions in einer anderen Region benötigen einen gesonderten Migrationsplan.

Chatarchivierung ist zusätzlich hinter `ENABLE_CHAT_ARCHIVAL=true` gesperrt, bis Aufbewahrung und Zugriff auf Archive abgestimmt sind. Maximalinstanzzahl und Parallelität sind auf eins beschränkt. Eine Codekonfiguration ersetzt keinen Nachweis tatsächlich bereitgestellter Ressourcen.
