import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConsentSettings } from '../src/components/ConsentSettings';
import { EINWILLIGUNG_VERSION } from '../src/server/pure';
const hooks = vi.hoisted(() => ({ refreshProfile: vi.fn(), request: vi.fn() }));
vi.mock('../src/lib/AuthContext', () => ({ useAuth: () => ({ profileData: { einwilligung: { version: EINWILLIGUNG_VERSION, zwecke: { produktanalyse: true } } }, refreshProfile: hooks.refreshProfile }) }));
vi.mock('../src/lib/authFetch', () => ({ authFetch: hooks.request }));
beforeEach(() => { vi.clearAllMocks(); hooks.refreshProfile.mockResolvedValue({}); });
describe('accessible consent withdrawal', () => {
  it('renders purpose-specific status with explicit context and announces success only after server evidence', async () => {
    hooks.request.mockResolvedValue(new Response(JSON.stringify({ ok: true, evidenceId: 'proof' })));
    render(<ConsentSettings />);
    expect(screen.getByText('Produktanalyse: Erlaubt')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Produktanalyse widerrufen' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('wurde widerrufen'));
    expect(hooks.refreshProfile).toHaveBeenCalledOnce();
  });
  it('keeps an unavailable withdrawal visible as a failure', async () => {
    hooks.request.mockResolvedValue(new Response('{}', { status: 503 }));
    render(<ConsentSettings />); fireEvent.click(screen.getByRole('button', { name: 'Produktanalyse widerrufen' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('konnte nicht bestätigt'));
    expect(hooks.refreshProfile).not.toHaveBeenCalled();
  });
});
