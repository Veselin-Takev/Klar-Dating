import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EinwilligungUndAlter } from '../src/components/EinwilligungUndAlter';

const refresh = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/AuthContext', () => ({ useAuth: () => ({ refreshProfile: refresh }) }));
vi.mock('../src/lib/api', () => ({ getAuthToken: async () => 'token' }));
beforeEach(() => { refresh.mockReset(); localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('consent UI persistence acknowledgement', () => {
  it('does not synthesize consent from an empty successful response', async () => {
    const done = vi.fn(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({})));
    render(<MemoryRouter><EinwilligungUndAlter onFertig={done} alterBereitsGeprueft /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Nichts davon' }));
    await screen.findByRole('alert');
    expect(done).not.toHaveBeenCalled(); expect(refresh).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });

  it('requires a matching authoritative record after consent persistence', async () => {
    const done = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ok: true, evidenceId: 'record', einwilligung: { version: 1 } })));
    refresh.mockResolvedValue({ isAdult: true, einwilligung: { evidenceId: 'different-record' } });
    render(<MemoryRouter><EinwilligungUndAlter onFertig={done} alterBereitsGeprueft /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Nichts davon' }));
    await screen.findByRole('alert'); expect(done).not.toHaveBeenCalled();
  });

  it('completes only after the durable decision has been reread', async () => {
    const done = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ok: true, evidenceId: 'record', einwilligung: { version: 1 } })));
    refresh.mockResolvedValue({ isAdult: true, einwilligung: { evidenceId: 'record' } });
    render(<MemoryRouter><EinwilligungUndAlter onFertig={done} alterBereitsGeprueft /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Nichts davon' }));
    await waitFor(() => expect(done).toHaveBeenCalledOnce()); expect(localStorage.length).toBe(0);
  });

  it('keeps the age step closed when the durable read fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ ok: true, isAdult: true })));
    refresh.mockRejectedValue(new Error('unavailable'));
    render(<MemoryRouter><EinwilligungUndAlter /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Geburtsdatum'), { target: { value: '1990-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('heading', { name: 'Wie alt bist du?' })).toBeInTheDocument();
    expect(localStorage.length).toBe(0);
  });
});
