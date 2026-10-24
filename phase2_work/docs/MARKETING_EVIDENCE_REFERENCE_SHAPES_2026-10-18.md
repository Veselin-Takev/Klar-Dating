# P0 #47 – Eindeutige GitHub-Evidenzreferenzen (18.10.2026)

**Status: DRAFT / NO-GO.** Aufbauend auf PR #91.

## Befund und Korrektur
Der Claim-Gate erkannte beliebige Pfade beginnend mit `/pull/`, `/commit/` oder `/blob/` als Implementierungsbelege an – auch Freitext und mehrdeutige URLs. Jetzt sind nur PR-URLs mit numerischer Nummer, Commit-URLs mit vollständiger 40-stelliger Hex-SHA und Blob-URLs mit vollständiger Commit-SHA und mindestens einem Dateipfadsegment zulässig. Workflow-Nachweise brauchen eine numerische Run-ID. Kodierte Pfadsegmente und leere Segmente werden vorsorglich abgewiesen.

## Nachweis und Grenzen
`node scripts/test-marketing-claims.mjs` prüft auch manipulierte PR-/Commit-/Actions-IDs. `node scripts/check-marketing-claims.mjs --release` muss bei der aktuellen Matrix erwartungsgemäß NO-GO liefern. Diese rein statische URL-Formprüfung bestätigt weder Existenz und erfolgreichen Abschluss eines GitHub-Actions-Laufs noch dessen exakten Quell-SHA oder unabhängige Product-/Legal-/Brand-Freigaben. Alle fünf Claims bleiben gesperrt. Die Pflichtprüfungen mit Node 22.23.3, Emulator, Vitest, Playwright und Build sowie Governance- und Datenschutzfreigaben stehen aus.

Keine produktiven Änderungen, keine GitHub-Actions-Neustarts, kein Merge. Issues #47 und #8 bleiben offen.
