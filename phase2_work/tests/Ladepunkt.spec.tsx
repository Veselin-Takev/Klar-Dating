import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReducedMotion } from 'motion/react';
import { Ladepunkt } from '../src/App';

vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>();
  return {
    ...actual,
    useReducedMotion: vi.fn(),
  };
});

describe('Ladepunkt Component & WCAG 2.3.3 Accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders Ladepunkt with standard motion when prefers-reduced-motion is false', () => {
    vi.mocked(useReducedMotion).mockReturnValue(false);

    render(<Ladepunkt />);

    const loader = screen.getByRole('status', { name: 'Wird geladen' });
    expect(loader).toBeInTheDocument();
    expect(loader).toHaveAttribute('data-reduced-motion', 'false');
    expect(loader.style.willChange).toBe('opacity, transform');
  });

  it('adheres to WCAG 2.3.3 by suppressing transitions when prefers-reduced-motion is true', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);

    render(<Ladepunkt />);

    const loader = screen.getByRole('status', { name: 'Wird geladen' });
    expect(loader).toBeInTheDocument();
    expect(loader).toHaveAttribute('data-reduced-motion', 'true');
    // Reduced motion optimizes will-change to avoid unnecessary GPU layers
    expect(loader.style.willChange).toBe('auto');
  });
});
