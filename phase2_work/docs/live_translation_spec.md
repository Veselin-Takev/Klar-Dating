# Spezifikation: Live-Übersetzung (Real-Time Translation)

## 1. Executive Summary
Barrierefreie Echtzeit-Kommunikation für Menschen unterschiedlicher Muttersprachen in der Dating-App "Klar".
Das System übersetzt Chat-Nachrichten auf lokaler Open-Source-Infrastruktur transient (ohne Vorhaltung des Klartexts auf dem Übersetzungs-Node) in die vom Empfänger bevorzugte Sprache.
Kommerzielle Drittanbieter (DeepL, Google, OpenAI) sind aus Datenschutz- und Kostengründen ausgeschlossen.

## 2. Architektur & Tech Stack
* **Microservice (Inference):** CTranslate2 + FastAPI (Python). Modell: NLLB-200 (INT8-quantisiert). Keine öffentliche IP.
* **Orchestrierung:** Node.js (Express) ruft den Python-Node intern via REST auf.
* **Performance:** Timeout bei 1200ms. Fällt der Node aus oder ist zu langsam, greift der Fallback (Originalnachricht ohne Übersetzung).

## 3. Datenmodell (Firestore)
Die Collection `chats/{chatId}/messages/{messageId}` erhält folgende optionale Felder:
* `originalText?: string` (Gesetzt, wenn `text` die Übersetzung enthält)
* `sourceLanguage?: string` (ISO 639-1)
* `targetLanguage?: string` (ISO 639-1)
* `translationError?: boolean` (True bei Timeout/Fehler des Inference-Nodes)

## 4. UI / UX System
* **Anti-Slop:** Keine farbigen Gradienten, keine "Magie"-Icons, keine wertende Mikrokopie.
* **MessageBubble:**
  * Dezenter Text-Indikator (`text-stone-500`/`400`, 11px) unter der Blase: "Übersetzt aus [Sprache]." oder "Original (Übersetzung verzögert)".
  * Touch-Target (≥ 44px): Tippen auf die Nachricht schaltet zwischen `text` und `originalText` um.
  * Screenreader: `aria-label` mit Hinweis auf den Übersetzungsstatus, `aria-live="polite"` beim Umschalten.

## 5. Security & Privacy (DSGVO)
* **Zero-Retention:** Der Inference-Microservice speichert/loggt keine Nachrichtentexte.
* **Löschkaskade:** Da die Übersetzungsdaten in den bestehenden `messages` abgelegt werden, werden sie bei einer Kontolöschung nach Art. 17 DSGVO automatisch mit dem Chat entfernt. Keine Änderungen am Backend-Löschskript nötig.
