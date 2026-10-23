# P0 #70 – TTL-Retention: negative Regressionen und Staging-Runbook (2026-10-18)

**Draft / NO-GO**, baut auf PR #114 auf.

## Befund
`scripts/configure-retention.sh` provisioniert in seinem gesicherten Staging-Plan 13 TTL-Collection-Groups. Die Aktivierungsanweisung unter `docs/DATA_RETENTION.md` verwies jedoch noch auf einen veralteten Befehl ohne Firestore-Datenbankkontext und verlangte fälschlich nur neun aktive Gruppen. Zudem bestand für den neuen Matrix-Gate nur ein positiver statischer Nachweis: Ob er bei gezielter Mutation tatsächlich verweigert, war nicht getestet.

## Korrektur und Tests
Die Retention-Anleitung zeigt wieder den sicheren Dry-Run-Standard und unterscheidet explizit eine nur nach unabhängiger Freigabe zulässige Staging-Anwendung einschließlich genauer Projekt-/Datenbankbestätigung. Der Nachweis verlangt nun alle 13 ACTIVE-Policies in der angegebenen Staging-Datenbank.

`node scripts/test-retention-matrix.mjs` kopiert Skript und Dokumentation in ein isoliertes temporäres Verzeichnis und prüft den positiven Kontrollfall sowie sechs negative Szenarien: fehlende Gruppe, doppelte Gruppe, entfernte Legal-Freigabe, entfernte Staging-Projektidentität, fehlender Datenbankkontext und fehlende Dokumentation. Die Tests rufen ausschließlich das lokale Node-Prüfskript auf, **niemals** `gcloud`.

## Grenzen und Freigabekriterien
Google-Firestore-TTL ist verzögert und nicht transaktional; aktive TTL-Policies sind kein Nachweis der sofortigen DSGVO-Art.-17-Löschung. Vor Production GO sind noch erforderlich: echte Node-v22.23.3-Testläufe, vollständige Firestore-Emulator- und E2E-Prüfungen, reale Staging-Policy-ACTIVE-Nachweise, dokumentierte Legal-Holds und Bestandsinventur, DPO/Privacy/Security/Legal/Finance-Freigaben. Keine Staging- oder Production-Mutation durch diese Änderung. Offene Issues #70 und #8 bleiben **NO-GO**.

Offizielle Dokumentation: https://firebase.google.com/docs/firestore/ttl
