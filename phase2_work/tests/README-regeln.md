# Firestore-Regeltests

```bash
npm run test:rules
```

Startet den Firestore-Emulator und führt `tests/rules.spec.ts` dagegen aus.
Braucht **Java 17** — im Devcontainer vorhanden, lokal ggf. nachinstallieren.

Die Projekt-ID ist an zwei Stellen `demo-klar`: hinter `--project` im
Skript und in `initializeTestEnvironment`. Beides muss übereinstimmen —
`firebase.json` steht auf `singleProjectMode`. Das Präfix `demo-` sorgt
dafür, dass die CLI keine Anmeldung verlangt und der Lauf nie eine echte
Datenbank erreichen kann.

## Warum es diese Tests gibt

Die Regeln behaupten seit dem ersten Prüfbericht Dinge: dass sich niemand
selbst verifizieren kann, dass Meldungen für niemanden lesbar sind, dass der
Kontingentzähler dem Server gehört. **Geprüft war davon nichts.** Eine Regel,
die nie ausgeführt wurde, ist eine Vermutung.

Zweimal wurden in diesem Projekt Regeln ausgeliefert, die die App unbenutzbar
gemacht hätten — kein Vorschlag, kein Chat. Beides hätte der erste Testlauf
gezeigt.

## Aufbau

Jeder Test prüft **genau eine** Regel. Ein Test, der drei Dinge auf einmal
prüft, sagt bei Rot nicht, welches davon kaputt ist.

Ausgangslage vor jedem Test: Anna und Bea verifiziert, Carl nicht. Diese
Dokumente werden mit `withSecurityRulesDisabled` angelegt — anders liesse sich
`isVerified` gar nicht setzen, und genau das ist ja der Punkt.

Der wichtigste Test heisst **„SELBSTVERIFIZIERUNG ist gesperrt"**. Er deckt den
Befund ab, der in diesem Projekt zweimal auftrat: eine Regel-Funktion namens
`isVerified()`, die nur die Anmeldung prüfte, und ein frei schreibbares Feld.

## Falls `npm install` mit ERESOLVE abbricht

`@firebase/rules-unit-testing@4` nennt als Peer `firebase@^11`, das Projekt
benutzt `^12`. Der `overrides`-Block in `package.json` weist npm an, für dieses
eine Paket die Wurzel-Version zu verwenden.

Das ist vertretbar — `rules-unit-testing` benutzt aus `firebase` nur die
modulare Firestore-API, die seit v9 stabil ist. Sauberer wäre eine Version, die
`firebase@12` selbst nennt. Zu prüfen mit:

```bash
npm view @firebase/rules-unit-testing@latest peerDependencies
```

Nennt sie `^12` oder breiter: diese Version eintragen und den
`overrides`-Block **löschen**.
