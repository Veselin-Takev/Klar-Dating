# Marketing-Claim-Gate: Integration (2026-10-24)

Die PR-Kette #88–#92 ist lokal auf main nach #82 vorbereitet. Alle fünf Claims bleiben blocked, releaseStatus bleibt NO-GO. Es wurden keine Nachweise oder Freigaben erfunden.

Der ursprüngliche Stand hatte keine CI-/Release-Anbindung. check:marketing-claims führt jetzt Schema- und Mutationstests in check:enterprise aus. check-production-release-approval.mjs ruft zusätzlich den kanonischen Check mit --release auf; Prozessfehler, Timeout oder gesperrte Claims blockieren die Produktionsfreigabe neben allen bestehenden Kontrollen.

Originale URL-Schreibweisen werden vor der URL-Normalisierung geprüft. Dot-/kodierte Traversalsegmente, alternative Ports, Backslashes, leere Pfadsegmente, ungültige/Null-IDs und fremde Origins werden abgewiesen. Commitgebundene Blob-Links benötigen mindestens ein Dateisegment, einschließlich README.md im Repository-Wurzelverzeichnis. Product-/Legal-/Brand-Identitäten müssen auch ohne Beachtung der Großschreibung verschieden sein. Die Tests funktionieren mit fileURLToPath auch unter Windows.

Validierung: Marketing-Schema- und Mutationstests bestehen; zusätzlich 87 Governance-/Release-Regressionstests. Der unveränderte kanonische Releasecheck verweigert die Freigabe mit 0/5 genehmigten Claims wie vorgesehen. Vollständige CI auf dem veröffentlichten integrierten PR-Head steht aus.

Die URL- und Reviewerprüfung bleibt strukturell: Sie beweist weder Existenz/Erfolg eines Actions-Laufs noch SHA-Zuordnung oder tatsächliche Reviewberechtigung. Unabhängige Nachweisprüfung, fachliche Freigaben und Produktionsfreigabe bleiben offen. Kein Deployment und keine Veröffentlichung von Marketingversprechen.
