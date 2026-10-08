import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import { axe } from 'jest-axe';
import AdminDashboard from './AdminDashboard';

// Mock recharts to avoid errors in JSDOM
vi.mock('recharts', () => {
  const Original = vi.importActual('recharts');
  return {
    ...Original,
    ResponsiveContainer: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    LineChart: () => <div>LineChart</div>,
    ScatterChart: () => <div>ScatterChart</div>,
    Line: () => <div>Line</div>,
    XAxis: () => <div>XAxis</div>,
    YAxis: () => <div>YAxis</div>,
    ZAxis: () => <div>ZAxis</div>,
    CartesianGrid: () => <div>CartesianGrid</div>,
    Tooltip: () => <div>Tooltip</div>,
    Scatter: () => <div>Scatter</div>,
  };
});

describe('AdminDashboard Accessibility', () => {
  it('should have no WCAG violations (including contrast and ARIA)', async () => {
    const { container } = render(<AdminDashboard />);
    const results = await axe(container);
    expect(results.violations).toHaveLength(0);
  });
});