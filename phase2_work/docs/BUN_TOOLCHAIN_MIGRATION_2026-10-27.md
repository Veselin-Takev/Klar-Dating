# Koordinierte Bun-Toolchain 1.4.4 – 27.10.2026

**Produktionsstatus NO-GO. Keine Lockfile-Neuauflösung oder Produktionsfreigabe.**

Der bestehende Dependabot-PR143 wird vervollständigt. Sein erster Lauf40407191573
scheiterte korrekt, weil nur das App-Dockerfile aktualisiert war und die übrige
Toolchain noch1.4.2 verlangte. Keine Prüfung wird für den Merge entfernt.

Offizieller Release bun-v1.4.4 ist kein Prerelease (veröffentlicht22.10.2026).
Docker-Hub-Registry-HEAD für oven/bun:1.4.4 bestätigt den Digest
`sha256:1d22548f177f4ff38e0c15baa3c2c46c6c2060ba2d1bc573bb4720b407548f1d`.
Beide Build-Kontexte verwenden diesen identischen Pin. Der Node-Runtime-Digest
und Node22.23.3 sowie npm10.9.2 für Functions bleiben unverändert.

Aktualisiert: beide packageManager-Deklarationen, GitHub-/GitLab-Bun-Installationen,
Downloadcache-Versionen, Codespaces-Bootstrap, Preflight, Docker-/Container-/Lock-
Policies und zugehörige Negativfixtures sowie aktuelle README-/Entwicklungsanleitungen.
Die Workflow-Policy prüft jetzt auch ausführbare bun-version-Zeilen streng auf1.4.4;
fehlende, gemischte oder bewegliche Werte sind ungültig, Kommentare kein Nachweis.

Historische Audits und frühere Release-Manifest-Blockermeldungen werden nicht
nachträglich als neue erfolgreiche Nachweise umgeschrieben. Die vorhandenen
Lockfiles sind bytegleich; vorhandene Dependency-Befunde werden nicht beseitigt
oder ignoriert. PR140s künftiger Scanner-Workflow muss bei einer späteren
Integration ebenfalls auf die dann genehmigte Toolchain synchronisiert werden.

Lokal unter Node24.22.1:25gezielte Docker-/Toolchain-/Node-/Preflight-Regressionen
bestanden. Toolchain-, CI-Pin-, Lock-, Container-Build-Vertrags- und Secret-Gates
bestanden. Kein echter Container-Build/OS-Scan und keine lokale Bun-Paketauflösung
behauptet. Linux-Codespaces-Bootstrap und vollständige Node22-/Bun1.4.4-/Emulator-/
Browser-CI des neuen Heads stehen aus. Ein grüner statischer Pin-Test beweist nicht,
dass alle Laufzeit-/Buildpfade mit der neuen Bun-Version erfolgreich sind.

Rollback: alle aktiven Bun-Pins, Digest, Policies und Setup-Anleitungen gemeinsam
auf den vorherigen geprüften Stand zurücksetzen; dieselbe vollständige CI ausführen.
Kein isolierter Dockerfile-Revert bei anders gepinnter CI. Kein Cloud-/Produktionslauf.

Vorheriger Abschluss: PR144 nach vollständiger CI40465252569 auf
ff91083adecf640dc2aef3ec142b2e03e727a64c integriert, Main-Merge
5f9004c29754e6fbe9ffddcf1122bde90b05e5a8; exakter Tree-Vergleich bestanden.
Das ist kein Nachweis einer tatsächlich veröffentlichten Produktionsattestierung.

Quellen:
- https://github.com/oven-sh/bun/releases/tag/bun-v1.4.4
- https://registry-1.docker.io/v2/oven/bun/manifests/1.4.4
