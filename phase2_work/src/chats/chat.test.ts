import { describe, it, expect } from 'vitest';

// Beispiel für Chat-Validierungslogik
function canUserSendMessage(chat: { participants: string[] }, userId: string, isVerified: boolean): boolean {
  if (!isVerified) return false;
  return chat.participants.includes(userId);
}

describe('Chat- & Messaging-Logik', () => {
  it('erlaubt verifizierten Teilnehmern das Senden von Nachrichten', () => {
    const chat = { participants: ['user1', 'user2'] };
    const canSend = canUserSendMessage(chat, 'user1', true);
    expect(canSend).toBe(true);
  });

  it('verhindert das Senden von Nachrichten für nicht verifizierte Nutzer', () => {
    const chat = { participants: ['user1', 'user2'] };
    const canSend = canUserSendMessage(chat, 'user1', false);
    expect(canSend).toBe(false);
  });

  it('verhindert das Senden von Nachrichten für Aussenstehende', () => {
    const chat = { participants: ['user1', 'user2'] };
    const canSend = canUserSendMessage(chat, 'outsider', true);
    expect(canSend).toBe(false);
  });
});
