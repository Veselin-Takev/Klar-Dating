import { vi, describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

function OnboardingInterests({ onSelectionChange }: { onSelectionChange?: (selected: string[]) => void }) {
  const [selected, setSelected] = React.useState<string[]>([]);

  const interests = [
    { id: 'vegan', label: 'Vegan', icon: '🌱' },
    { id: 'oktoberfest', label: 'Oktoberfest', icon: '🥨' },
    { id: 'kochen', label: 'Kochen', icon: '🍳' },
    { id: 'sport', label: 'Sport', icon: '⚽' },
    { id: 'kultur', label: 'Kultur', icon: '🎭' },
    { id: 'reisen', label: 'Reisen', icon: '✈️' },
    { id: 'musik', label: 'Musik', icon: '🎵' },
  ];

  const toggleInterest = (id: string) => {
    const updated = selected.includes(id)
      ? selected.filter(item => item !== id)
      : [...selected, id];
    setSelected(updated);
    if (onSelectionChange) onSelectionChange(updated);
  };

  return (
    <div>
      <h2>Was begeistert dich?</h2>
      <div className="grid">
        {interests.map(interest => (
          <button
            key={interest.id}
            type="button"
            data-testid={`interest-${interest.id}`}
            aria-pressed={selected.includes(interest.id)}
            onClick={() => toggleInterest(interest.id)}
          >
            <span>{interest.icon}</span>
            <span>{interest.label}</span>
          </button>
        ))}
      </div>
      <p data-testid="selection-count">Ausgewählt: {selected.length}</p>
    </div>
  );
}

describe('OnboardingInterests Komponente', () => {
  it('rendert alle Interessen-Kacheln inklusive "Musik"', () => {
    render(<OnboardingInterests />);
    expect(screen.getByText(/Was begeistert dich\?/i)).toBeDefined();
    expect(screen.getByTestId('interest-musik')).toBeDefined();
    expect(screen.getByText('Musik')).toBeDefined();
  });

  it('erlaubt das Auswählen und Abwählen von Interessen', () => {
    const onSelectionChange = vi.fn();
    render(<OnboardingInterests onSelectionChange={onSelectionChange} />);

    const musicButton = screen.getByTestId('interest-musik');
    expect(musicButton.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(musicButton);
    expect(musicButton.getAttribute('aria-pressed')).toBe('true');
    expect(onSelectionChange).toHaveBeenCalledWith(['musik']);

    fireEvent.click(musicButton);
    expect(musicButton.getAttribute('aria-pressed')).toBe('false');
    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });
});
