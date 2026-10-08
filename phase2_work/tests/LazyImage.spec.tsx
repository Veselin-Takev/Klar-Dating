import { render, screen, fireEvent } from '@testing-library/react';
import { LazyImage } from '../src/components/LazyImage';
import { describe, it, expect } from 'vitest';

describe('LazyImage Component', () => {
  it('renders a skeleton initially and sets loading="lazy"', () => {
    const { container } = render(<LazyImage src="test.jpg" alt="Test Image" />);

    const img = screen.getByAltText('Test Image');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveClass('opacity-0');

    // Skeleton should be visible
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('shows the image and removes skeleton on load', () => {
    const { container } = render(<LazyImage src="test.jpg" alt="Test Image" />);
    const img = screen.getByAltText('Test Image');

    fireEvent.load(img);

    expect(img).toHaveClass('opacity-100');
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).not.toBeInTheDocument();
  });

  it('shows a fallback on error', () => {
    render(<LazyImage src="bad.jpg" alt="Test Image" />);
    const img = screen.getByAltText('Test Image');

    fireEvent.error(img);

    expect(img).not.toBeInTheDocument();
    expect(screen.getByLabelText('Bild konnte nicht geladen werden')).toBeInTheDocument();
  });
});
