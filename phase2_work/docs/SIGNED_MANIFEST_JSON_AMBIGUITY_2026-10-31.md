# P0 #254 – Mehrdeutige JSON-Repräsentation in signierten Tenant-Migrationsnachweisen

**Stand:** 31.10.2026 · **Status:** Draft / BLOCKED / NO-GO · **Basis:** [PR #257](https://github.com/Veselin-Takev/Klar-Dating/pull/257), Commit `b7288f633f72da81ef55e10cb0a1ad602a73bc9f`, [Enterprise CI #41232693749](https://github.com/Veselin-Takev/Klar-Dating/actions/runs/41232693749) abgeschlossen mit `success`.

## Konkreter Sicherheitsbefund

Der bisherige Attestierungsvalidator prüft Ed25519-Signaturen und den unabhängig gepinnten öffentlichen Schlüsselring über **exakte Bytes**, wertet die signierten JSON-Dateien anschließend aber durch natives `JSON.parse` aus. Der Parser akzeptiert wiederholte Schlüssel und behält den letzten Wert. Beispielsweise kann ein ausreichend signaturberechtigter Akteur eine ursprünglich anders ausgewiesene `tenantId` oder den Löschstatus zuerst im JSON aufführen und danach einen abweichenden zweiten Wert hinzufügen; das geparste Zod-Objekt enthält nur den letzten. Externe Review-/Audit-Parser könnten dieselben signierten Originalbytes anders interpretieren. Formal valide Signaturen schützen nicht gegen **unterschiedliche Semantik auf verschiedenen Parsern**.

## Korrektur im isolierten Draft

**Verbindliches deterministisches JSON-Profil (Node.js 22 / JSON.stringify):**

1. Der Validator dekodiert die Bytes ausschließlich als **striktes UTF-8** (`TextDecoder('utf-8', { fatal: true, ignoreBOM: true })`). Kaputte UTF-8-Sequenzen und BOM werden verweigert.
2. Eine valide JSON-Parse muss dieselbe UTF-8-Bytefolge wieder ergeben, wenn sie mit `JSON.stringify` serialisiert wird. `JSON.stringify(JSON.parse(original)) === original` ist deshalb verpflichtend, **nach** der Signaturprüfung und **vor** Zod-/Eigentumsentscheidungen.
3. Doppelte Schlüssel, JSON-Whitespace-Varianten, abweichende Escapes, ein BOM und andere mehrdeutige oder nicht reproduzierbare Darstellungen werden fail-closed verweigert. Auch der bereits SHA-gepinnte Keyring muss dieses Profil erfüllen.
4. **Kein RFC 8785 / JCS-Versprechen.** Dieses Profil ist bewusst eng auf die bestehende JavaScript-Toolchain und die synthetisch getestete Node-22-Auswertung begrenzt. Ein externer Exporter muss die validierten Objekte deterministisch mit `JSON.stringify` serialisieren, die **exakten** resultierenden Bytes signieren und bei Formatänderungen erneut beide freigegebenen Signaturrollen verwenden.

Neue Negativtests erzeugen **vollständig mit beiden Rollen korrekt signierte** JSON-Dateien mit doppelten `tenantId`- und `deletionState`-Schlüsseln, neu signierten Whitespace-Varianten, BOM und kaputten UTF-8-Folgen sowie einen neuen SHA-gepinnten, aber doppelt beschrifteten Keyring. Die Auswertung muss diese Fälle ohne Migration ablehnen. Der vorhandene positive Fall mit gültigen beiden Signaturen und blockierter Freigabe muss bestehen bleiben.

## Abgrenzung und Rest-Risiken

Die Änderung wirkt ausschließlich auf den **Offline-Migrations-Preflight** und den öffentlichen Schlüsselring. Sie führt keine Firestore-Zugriffe, keinen Live-Schreibvorgang und keine Datenbewegung aus; auch jede erfolgreiche signierte Prüfung liefert weiterhin `BLOCKED_MANUAL_APPROVAL_REQUIRED`.

Ausstehend bleiben nachweislich autorisierte Signer-Rollen, direkte Original-Firestore-Quellbyte-Attestierung, Snapshot-Freshness/Revocation/Anti-Replay gegen **vollständig alte, aber gültige** doppelt signierte Dateien, Eigentümer-/UID-Zuordnung und Live-BOLA/IDOR-/Art.-17-/KYC-/Chat-/Payment-Sicherheit. Der neue Code benötigt exakte Gesamt-CI und unabhängige AppSec-/DPO-/SRE-Reviews. **Production NO-GO.**
