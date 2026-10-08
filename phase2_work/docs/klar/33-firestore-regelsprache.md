# 33 · Was in Firestore-Regeln trägt — fünf Messrunden

Stand 14.08.2026. Alle Zeilen dieser Tabellen sind **gemessen**, nicht
gelesen: `npm run test:rules-sprache` baut je Fall eine winzige Regel mit
genau einer Konstruktion und schreibt auf, was der Emulator antwortet.

Anlass war ein `evaluation error` in `firestore.rules`. Der ist **nicht
behoben** (siehe Abschnitt 4). Was dabei entstand, ist trotzdem das
Nützlichere.

---

## 1. Die Tabelle

**ABSTURZ** = `evaluation error` — die Regel ist beim Rechnen gestolpert.
**false** = die Regel hat entschieden und abgelehnt. Das ist der gewollte Fall.

| | Konstruktion | Ergebnis |
|:--|:--|:--|
| A | `false && data.fehlt is string` | sauber abgelehnt |
| B | `false ? data.fehlt is string : true` | durchgelassen |
| C | `data.fehlt is string` (allein) | sauber abgelehnt |
| D | `hasAll(['b']) && data.b is string` | sauber abgelehnt |
| E | `data.get('fehlt', '') == ''` | durchgelassen |
| F | `(!('b' in data) \|\| data.b is string)` | durchgelassen |
| G | `resource == null` | durchgelassen |
| **H** | **`resource != null && resource.data.x == 1`** | **ABSTURZ** |
| I | `resource != null ? resource.data.x == 1 : …` | durchgelassen |
| J | `cond ? pruef(resource.data) : true` | durchgelassen |
| **K** | **`pruef(resource.data)` ohne Absicherung** | **ABSTURZ** |
| L | `pruef(resource)`, Null-Prüfung *in* der Funktion | durchgelassen |
| M | `!exists(pfad) \|\| pruef(resource.data)` | durchgelassen |
| N | `kette && (cond ? pruef(resource.data) : true)` | durchgelassen |
| O | `kette && pruef(resource)` [drinnen] | durchgelassen |
| P | `kette && (!exists(pfad) \|\| pruef(res.data))` | durchgelassen |

---

## 2. Die drei Regeln, die daraus folgen

### 2a · Ein fehlendes FELD ist harmlos. Ein fehlendes DOKUMENT nicht.

`data.fehlt is string` auf einem Datensatz ohne dieses Feld ergibt schlicht
`false` (C). Das gilt auch mitten in einer `&&`-Kette (A, D).

`resource.data` bei einem Dokument, das es **nicht gibt**, ist etwas anderes:
`resource` ist dann `null`, und der Zugriff darauf lässt die Regel abstürzen
(H, K).

> Diese Unterscheidung ist der Kern. Wer sie nicht kennt, sichert die
> falsche Stelle ab — genau das ist hier sechsmal passiert.

### 2b · `&&` schützt nicht vor `null`.

`resource != null && resource.data.x == 1` **stürzt ab** (H), obwohl die
linke Seite `false` ergibt. Der Ternär an derselben Stelle trägt (I).

Das widerspricht der Erwartung aus anderen Sprachen und ist der Grund,
warum die naheliegendste Reparatur wirkungslos bleibt.

### 2c · Es gibt drei tragfähige Formen — und sie tragen auch in einer Kette.

| Form | Beispiel |
|:--|:--|
| **Ternär** | `resource != null ? pruef(resource.data) : false` |
| **Prüfung in der Funktion** | `pruef(resource)` mit `d == null ? … : d.data.x` |
| **`exists()`** | `!exists(pfad) \|\| pruef(resource.data)` |

Alle drei bleiben tragfähig, wenn sie am Ende einer `&&`-Kette stehen
(N, O, P) — das war die letzte offene Frage und ist beantwortet.

---

## 3. Wann der Fall überhaupt auftritt

`setDoc(ref, daten, { merge: true })` auf ein Dokument, **das es noch nicht
gibt**. Firestore wertet dann **beide** Zweige aus — `create` *und* `update`
— und im `update`-Zweig ist `resource` gleich `null`.

Bei einem neuen Konto ist genau das der allererste Schreibvorgang.

**Gemessen an der echten Regel** (`npm run test:rules-diagnose`):

| Fall | create | update |
|:--|:--|:--|
| vollständige Pflichtfelder, ohne merge | ja | — |
| vollständige Pflichtfelder, **mit** merge | ja | — |
| nur ein Teilfeld, ohne merge | false | ABSTURZ |
| nur ein Teilfeld, **mit** merge | ABSTURZ | ABSTURZ |
| leeres Objekt + merge | ABSTURZ | ABSTURZ |

---

## 4. Was offen ist — und was daran lehrreich war

**Der Fehler besteht.** `firestore.rules` stürzt weiterhin ab (L169 create,
L202 update). Sechs Reparaturversuche, alle zurückgenommen.

**Warum keiner half:** Jeder beruhte auf einer Messung — und jedes Mal habe
ich die **Reichweite** dieser Messung überschätzt. Runde 3 zeigte, dass der
Ternär trägt; daraus wurde geschlossen, er trage *überall*, ohne zu prüfen,
ob die echte Regel dieselbe Form hat. Sie hatte sie nicht: `keepsServerFields()`
liest `resource` **ohne Argument**, direkt aus dem globalen Kontext. Auch
das zu ändern half nicht — es bleibt also noch etwas, das nie nachgebaut
wurde.

**Der richtige nächste Schritt ist Bisektion, nicht ein siebter Versuch:**
die echte `users`-Regel mitsamt ihren echten Funktionen ins Labor kopieren,
prüfen dass sie **dort auch kracht**, und dann Bedingung für Bedingung
entfernen, bis der Absturz verschwindet. Die zuletzt entfernte Zeile ist die
Ursache. Mühsamer als raten, aber es endet garantiert.

**Zur Dringlichkeit:** Der Fehler lässt eine Regel abstürzen, die ohnehin
ablehnen soll. Es entsteht **keine Lücke** — nur eine falsche Begründung.
Über den Theme-Weg tritt er seit `fdeaa3c` nicht mehr auf. Wichtig ist er
trotzdem: Eine Regel, die stolpert statt zu entscheiden, ist an jeder
anderen Stelle ebenso wenig vorhersehbar.

---

## 5. Die Werkzeuge

| Befehl | Was er tut |
|:--|:--|
| `npm run test:rules-diagnose` | Zehn Fälle gegen die **echte** Regel, mit Übersichtstabelle am Ende |
| `npm run test:rules-sprache` | Sechzehn Fälle gegen **winzige Laborregeln**, je eine Konstruktion |

Beide hängen **nicht** in `npm run verify` — sie behaupten nichts, sie
berichten. Ein Diagnoselauf, der `verify` rot färben kann, wird abgeschaltet;
einer, der nur Auskunft gibt, bleibt.

---

## 6. Die Lehre, die über Firestore hinausgeht

Dreimal in dieser Reihe wurde aus einer Teilansicht geschlossen:

1. Runde 2 verglich zwei Fälle, bei denen **zwei** Dinge gleichzeitig
   verschieden waren (Inhalt *und* `merge`).
2. Beim Lesen des Ergebnisses waren drei von sechs Fällen weggescrollt —
   und es wurde trotzdem geschlossen.
3. Die Laborform wurde für allgemeingültig gehalten, ohne die echte Regel
   danebenzulegen.

Daraus die Regeln, die in diesem Projekt ohnehin gelten, hier aber teuer
gelernt wurden:

> **Ändere je Messung genau eine Sache.**
> **Sieh das ganze Ergebnis an, bevor du schliesst** — deshalb hat der
> Diagnoselauf seit Runde 3 eine Übersicht am Ende.
> **Eine Konstruktion, die im Labor trägt, trägt im Original nur dann, wenn
> das Original dieselbe Konstruktion ist.**
