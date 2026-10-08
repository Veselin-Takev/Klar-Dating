# Klar v149 — Legal Updates, Live-Übersetzung, Language Switcher & Readability

Datum: 2026-10-07

## Umsetzung

- `legal_updates` bleibt backend-kontrolliert und clientseitig unveränderbar.
- `users/{uid}/legal_acknowledgements/{updateId}` wird ausschließlich über die authentifizierte API bestätigt.
- Legal Updates verwenden ein konsistentes Datenmodell (`version`, `publishedAt`, i18n keys, `sourceUrl`, `actionRequired`).
- Modal verwendet `role=dialog`, Tabs/Tabpanel, Fokusmanagement, Escape und Design-System-Tokens.
- `/api/translate` ist authentifiziert und durch die bestehende KI-Einwilligungsgrenze geschützt.
- Eingabetext wird vor jeder externen Übersetzung durch `sanitizePromptInput` bereinigt.
- Die Übersetzungsroute verwendet ausschließlich den konfigurierten Open-Source/Self-Hosted-Übersetzungsdienst. Es gibt keinen kostenpflichtigen Gemini-Fallback.
- Bei Ausfall bleibt der Originaltext unverändert und wird nicht als Übersetzung ausgegeben.
- Live-Übersetzung betrifft ausschließlich eingehende Nachrichten; ausgehende Nachrichten werden immer im Original gespeichert/versendet.
- Übersetzte Nachrichten behalten den Originaltext und können in der Bubble wieder angezeigt werden.
- Language Switcher unterstützt DE/EN/ES/FR, persistiert `klar_language`, synchronisiert i18next und `document.documentElement.lang`.
- Systembar ist responsive und keyboard-/screenreader-fähig.
- Globale Design-Tokens gewährleisten WCAG-AA-Kontrast und konsistente Klar-Lesbarkeit.

## Verifikation

Fachliche Gates:

- `check:legal-updates`: PASS
- `check:language-switcher`: PASS
- `check:chat-translation`: PASS
- `check:design-system`: PASS
- `check:kontrast`: PASS

Die sechs Release-Kommandos werden im Release-Log mit ihrem tatsächlichen Exit-Code dokumentiert. Ein fehlendes lokales Tooling wird als `BLOCKED_ENVIRONMENT`, niemals als PASS, bewertet.
