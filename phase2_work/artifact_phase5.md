# Phase 5: Implementierungs-Artefakte (Live-Übersetzung)

## 1. Firestore Security Rules (Erweiterung)
```javascript
// firestore.rules
match /chats/{chatId}/messages/{messageId} {
  // Erlaubt dem Backend-Service das Schreiben (via Firebase Admin SDK / Service Account bypassen Regeln sowieso)
  // Wichtig für den Client: Clients dürfen NICHT in die translations schreiben, um Spoofing zu verhindern!

  allow create: if request.auth != null
                && request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants
                // Verbiete dem Client, das "translations" Feld selbst zu setzen:
                && !("translations" in request.resource.data);

  allow read: if request.auth != null
              && request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
}
```

## 2. Node.js (Express) Translation Proxy Skeleton
```typescript
// server/translation.ts
import express from 'express';
import fetch from 'node-fetch'; // oder axios
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const router = express.Router();
const TRANSLATION_API = process.env.LIBRETRANSLATE_URL || 'http://localhost:5000/translate';

router.post('/message', async (req, res) => {
  const { chatId, text, senderId, targetLang } = req.body;
  const db = getFirestore();

  try {
    // 1. Asynchroner Call an das lokale Open-Source Modell
    const translateReq = await fetch(TRANSLATION_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: 'auto', target: targetLang })
    });

    let translations = {};
    let status = 'failed';

    if (translateReq.ok) {
      const data = await translateReq.json();
      translations[targetLang] = data.translatedText;
      status = 'success';
    }

    // 2. Persistierung in Firestore
    const msgRef = db.collection(`chats/${chatId}/messages`).doc();
    await msgRef.set({
      senderId,
      text: text, // Raw text immer speichern
      translations,
      translationStatus: status,
      timestamp: FieldValue.serverTimestamp()
    });

    res.status(200).json({ success: true, messageId: msgRef.id });

  } catch (error) {
    console.error("Translation Error:", error);
    // Graceful Fallback: Nachricht dennoch in Originalsprache abspeichern
    await db.collection(`chats/${chatId}/messages`).add({
      senderId,
      text,
      translationStatus: 'failed',
      timestamp: FieldValue.serverTimestamp()
    });
    res.status(200).json({ success: true, status: 'fallback_original' });
  }
});
```

## 3. UI Component Skeleton (React/Tailwind)
```tsx
// src/components/ChatMessage.tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Languages } from 'lucide-react';

export function ChatMessage({ message, currentUserLang }) {
  const isMine = message.senderId === 'current-user';
  const hasTranslation = message.translations && message.translations[currentUserLang];

  const [showOriginal, setShowOriginal] = useState(false);

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`relative px-4 py-3 rounded-2xl max-w-[75%] ${isMine ? 'bg-brand text-white' : 'bg-stone-100 text-stone-900'}`}>

        {/* Main Text (Translated if available and not showing original) */}
        <p className="text-[15px] leading-relaxed">
          {hasTranslation && !showOriginal ? message.translations[currentUserLang] : message.text}
        </p>

        {/* Animated Original Reveal */}
        <AnimatePresence>
          {hasTranslation && showOriginal && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              className="border-t border-stone-200/20 pt-2"
            >
              <span className="text-xs uppercase font-semibold opacity-50 mb-1 block">Original:</span>
              <p className="text-sm italic opacity-80">{message.text}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Translation Toggle Badge */}
        {!isMine && hasTranslation && (
          <button
            onClick={() => setShowOriginal(!showOriginal)}
            aria-label={showOriginal ? "Übersetzung zeigen" : "Original zeigen"}
            className="absolute -bottom-2 -right-2 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-full p-1.5 shadow-sm text-stone-400 hover:text-brand transition-colors"
          >
            <Languages size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
```
