import { readFileSync, existsSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const chat = readFileSync(new URL('../src/screens/ChatView.tsx', import.meta.url), 'utf8');
const bubble = readFileSync(new URL('../src/components/MessageBubble.tsx', import.meta.url), 'utf8');
const requiredTokens = ['--color-canvas: #faf8f5;', '--font-serif:', '--font-sans:'];
const requiredPrimitives = ['.klar-page', '.klar-card', '.klar-input', '.klar-icon-button', '.klar-chat-message', '.klar-chat-scroll'];
const requiredChat = ['klar-chat-scroll', 'klar-input', 'aria-label="Nachricht senden"', 'aria-label="Nachricht eingeben"'];
let errors = 0;
for (const value of requiredTokens) if (!css.includes(value)) { console.error(`Missing design token: ${value}`); errors++; }
for (const value of requiredPrimitives) if (!css.includes(value)) { console.error(`Missing design primitive: ${value}`); errors++; }
for (const value of requiredChat) if (!chat.includes(value)) { console.error(`Missing chat accessibility/design contract: ${value}`); errors++; }
if (!bubble.includes('klar-chat-message') || !bubble.includes('whitespace-pre-wrap')) { console.error('Message bubble readability contract missing'); errors++; }
if (!chat.includes('<header') || !chat.includes('</header>')) { console.error('Chat semantic header contract missing'); errors++; }
console.log(errors === 0 ? 'Design system boundary: PASS' : `Design system boundary: ${errors} violation(s)`);
process.exit(errors === 0 ? 0 : 1);
