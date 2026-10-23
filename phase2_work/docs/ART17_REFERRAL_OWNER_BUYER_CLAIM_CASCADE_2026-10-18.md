# P0 #56 – Art. 17 Eigentümer-Löschung und fremde Käufer-Claims (18.10.2026)

**Status: Draft / NO-GO.** In `src/server/trustAndSafety.ts` wurden bereits referral-Eigentümerdaten und anhand `buyerRef` verknüpfte Claims des zu löschenden Käufers entfernt. Ein anderer Klar-Käufer kann aber über `referralId` auf einen Referral-Link des zu löschenden Eigentümers verweisen. Der Käufer-Claim hat keinen Eigentümer-Pseudonymbezug und blieb beim Löschen des Referral-Eigentümers zurück.

## Korrektur
Für jeden personenbezogenen Referral-Link des zu löschenden Eigentümers werden zuerst alle verknüpften `partner_referral_buyer_claims` per `referralId` in begrenzten Batches gelöscht und **danach** der Referral-Link selbst entfernt. Bestehende Löschslices/Resume-Hilfsfunktionen (`checkDeletionSlice`, `loescheAbfrage`, `recordDeletionProgress`) werden verwendet; bei Abbruch existiert der Eltern-Link weiterhin, sodass ein Wiederanlauf die abhängigen Claims erneut findet. Danach bleiben die vorhandenen ownerRef-/buyerRef-basierten Event-/Ledger-Bereinigungen aktiv. Diese zusätzlichen Löschungen können von unabhängigen Betroffenenrechten, Belegpflichten oder Legal Holds betroffen sein; eine rechtsverbindliche Aufbewahrungsmatrix ist vor GO noch freizugeben.

## Tests und Ausnahmepfade
`scripts/check-art17-deletion-audit.mjs` überprüft nun statisch die Abhängigkeit `referralId` und die Reihenfolge Claim-Löschung → Link-Löschung. Das ist **kein** Firebase-Emulator-, Konkurrenz- oder vollständiger personenbezogener Löschungsnachweis. E2E prüfen: Eigentümer A/B-Käufer C, mehrere Claims pro Referral, Abbruch zwischen Claims und Elternlöschung, erneuter Lauf, Löschbelege, Legal-Hold-Ausnahmen und Null-Restbestand nach Abschluss. Die bestehende Dokumentation bleibt `NO-GO` bis Privacy/DPO-/Security-/Legal-Review und Node22.23.3-Vitest-/Emulator-/Playwright-/Build-Gates.

Referenzen: https://firebase.google.com/docs/firestore/manage-data/delete-data und https://eur-lex.europa.eu/eli/reg/2016/679/oj
