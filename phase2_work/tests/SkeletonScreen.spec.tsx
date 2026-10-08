import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, it, expect } from 'vitest';
import {
  AppSkeleton,
  ChatSkeleton,
  ChatsListSkeleton,
  DashboardSkeleton,
  ChatBubbleSkeleton,
  ChatTypingSkeleton,
  getSkeletonVariant,
  isChatPath,
  isChatsListPath,
} from '../src/components/SkeletonScreen';

describe('Path Detection Functions', () => {
  describe('isChatPath', () => {
    it('detects /chat and /chat/:id paths', () => {
      expect(isChatPath('/chat')).toBe(true);
      expect(isChatPath('/chat/')).toBe(true);
      expect(isChatPath('/chat/user-42')).toBe(true);
      expect(isChatPath('/chat/user-42?active=true#unread')).toBe(true);
      expect(isChatPath('/chats/user-99')).toBe(true);
    });

    it('rejects general routes and overview /chats', () => {
      expect(isChatPath('/chats')).toBe(false);
      expect(isChatPath('/chats/')).toBe(false);
      expect(isChatPath('/')).toBe(false);
      expect(isChatPath('/profile')).toBe(false);
      expect(isChatPath('')).toBe(false);
    });
  });

  describe('isChatsListPath', () => {
    it('detects /chats overview list', () => {
      expect(isChatsListPath('/chats')).toBe(true);
      expect(isChatsListPath('/chats/')).toBe(true);
      expect(isChatsListPath('/chats?tab=all')).toBe(true);
    });

    it('rejects /chat and individual chat paths', () => {
      expect(isChatsListPath('/chat')).toBe(false);
      expect(isChatsListPath('/chat/123')).toBe(false);
      expect(isChatsListPath('/')).toBe(false);
    });
  });

  describe('getSkeletonVariant', () => {
    it('identifies root and general routes as dashboard', () => {
      expect(getSkeletonVariant('/')).toBe('dashboard');
      expect(getSkeletonVariant('')).toBe('dashboard');
      expect(getSkeletonVariant('/profile')).toBe('dashboard');
      expect(getSkeletonVariant('/safety')).toBe('dashboard');
    });

    it('identifies /chat and /chat/:id routes as chat', () => {
      expect(getSkeletonVariant('/chat')).toBe('chat');
      expect(getSkeletonVariant('/chat/')).toBe('chat');
      expect(getSkeletonVariant('/chat/user-123')).toBe('chat');
      expect(getSkeletonVariant('/chat/456?ref=notification')).toBe('chat');
    });

    it('identifies /chats overview as chats', () => {
      expect(getSkeletonVariant('/chats')).toBe('chats');
      expect(getSkeletonVariant('/chats/')).toBe('chats');
      expect(getSkeletonVariant('/chats?tab=active')).toBe('chats');
    });
  });
});

describe('ChatBubbleSkeleton Component', () => {
  it('renders incoming message bubble with avatar and timestamp', () => {
    render(<ChatBubbleSkeleton isMe={false} lines={2} />);
    const bubble = screen.getByTestId('chat-bubble-incoming-skeleton');
    expect(bubble).toBeInTheDocument();
    expect(bubble.className).toContain('justify-start');
  });

  it('renders outgoing message bubble aligned right without avatar', () => {
    render(<ChatBubbleSkeleton isMe={true} lines={1} statusIcon={true} />);
    const bubble = screen.getByTestId('chat-bubble-outgoing-skeleton');
    expect(bubble).toBeInTheDocument();
    expect(bubble.className).toContain('justify-end');
  });

  it('renders typing indicator bubble', () => {
    render(<ChatTypingSkeleton />);
    expect(screen.getByTestId('chat-typing-skeleton')).toBeInTheDocument();
  });
});

describe('AppSkeleton Component', () => {
  it('renders chat skeleton with message bubbles when on chat path', () => {
    render(<AppSkeleton pathname="/chat/test-partner" />);

    const skeleton = screen.getByRole('status');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('data-variant', 'chat');
    expect(skeleton).toHaveAttribute('aria-label', 'Chat wird geladen');

    const bubblesContainer = screen.getByTestId('chat-bubbles-container');
    expect(bubblesContainer).toBeInTheDocument();

    const incomingBubbles = screen.getAllByTestId('chat-bubble-incoming-skeleton');
    const outgoingBubbles = screen.getAllByTestId('chat-bubble-outgoing-skeleton');
    expect(incomingBubbles.length).toBeGreaterThan(0);
    expect(outgoingBubbles.length).toBeGreaterThan(0);
  });

  it('renders dashboard skeleton when on root path', () => {
    render(<AppSkeleton pathname="/" />);

    const skeleton = screen.getByRole('status');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('data-variant', 'dashboard');
    expect(skeleton).toHaveAttribute('aria-label', 'Dashboard wird geladen');

    const dashboardSkeleton = screen.getByTestId('dashboard-skeleton');
    expect(dashboardSkeleton).toBeInTheDocument();
  });

  it('renders chats list skeleton when on /chats path', () => {
    render(<AppSkeleton pathname="/chats" />);

    const skeleton = screen.getByRole('status');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveAttribute('data-variant', 'chats');
    expect(skeleton).toHaveAttribute('aria-label', 'Chats werden geladen');

    const chatsList = screen.getByTestId('chats-list-skeleton');
    expect(chatsList).toBeInTheDocument();
  });

  it('dynamically reads path from MemoryRouter context when pathname prop is omitted', () => {
    render(
      <MemoryRouter initialEntries={['/chat/alex-42']}>
        <AppSkeleton />
      </MemoryRouter>
    );

    const skeleton = screen.getByRole('status');
    expect(skeleton).toHaveAttribute('data-variant', 'chat');
    expect(screen.getByTestId('chat-bubbles-container')).toBeInTheDocument();
    expect(screen.getAllByTestId('chat-bubble-incoming-skeleton').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('chat-bubble-outgoing-skeleton').length).toBeGreaterThan(0);
  });

  it('renders standalone individual skeleton components without crashing', () => {
    const { unmount: u1 } = render(<ChatSkeleton />);
    expect(screen.getByTestId('chat-skeleton')).toBeInTheDocument();
    u1();

    const { unmount: u2 } = render(<DashboardSkeleton />);
    expect(screen.getByTestId('dashboard-skeleton')).toBeInTheDocument();
    u2();

    const { unmount: u3 } = render(<ChatsListSkeleton />);
    expect(screen.getByTestId('chats-list-skeleton')).toBeInTheDocument();
    u3();
  });

  it('applies optimized will-change: opacity, transform property for smooth rendering performance', () => {
    render(<AppSkeleton pathname="/" />);
    const skeleton = screen.getByRole('status');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton.style.willChange).toBe('opacity, transform');
    expect(skeleton.className).toContain('[will-change:opacity,transform]');
  });
});
