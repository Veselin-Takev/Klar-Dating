import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import i18n from '../i18n/config';
import { MessageBubble } from './MessageBubble';
import type { ChatMessage } from '../screens/ChatView';

describe('localized accessible message translation', () => {
  it('uses a native toggle button and displays the selected text', async () => {
    await i18n.changeLanguage('en');
    render(<MessageBubble msg={{ id: '1', role: 'verbindung', text: 'Hello', originalText: 'Hallo', sourceLanguage: 'de', createdAt: 'invalid' } as ChatMessage} />);
    const toggle = screen.getByRole('button', { name: 'Show original' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(screen.getByText('Hallo')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Show translation' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
  });
});
