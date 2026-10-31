// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const hooks = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../src/lib/authFetch', () => ({ authFetch: hooks.request }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
import { BiometricsVerificationModal } from '../src/components/BiometricsVerificationModal';

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

function clickRefresh(onSuccess = vi.fn()) {
  render(<BiometricsVerificationModal isOpen onSuccess={onSuccess} onCancel={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'kyc.refresh' }));
  return onSuccess;
}

beforeEach(() => { hooks.request.mockReset(); });
afterEach(() => { cleanup(); });

describe('profile identity refresh uses the authoritative Didit status contract', () => {
  it('accepts only signed-provider-backed approved status', async () => {
    hooks.request.mockResolvedValue(response({ status: 'approved' }));
    const onSuccess = clickRefresh();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(hooks.request).toHaveBeenCalledExactlyOnceWith('/api/kyc/status');
  });

  it.each(['pending', 'review', 'not_started'])(
    'never reports verification success for %s', async status => {
      hooks.request.mockResolvedValue(response({ status, isVerified: true }));
      const onSuccess = clickRefresh();
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('kyc.photoPending'));
      expect(onSuccess).not.toHaveBeenCalled();
      expect(hooks.request).toHaveBeenCalledExactlyOnceWith('/api/kyc/status');
    },
  );

  it.each([
    { label: 'legacy boolean impersonation', data: { isVerified: true } },
    { label: 'unavailable provider', data: { status: 'unavailable' } },
    { label: 'unknown future state', data: { status: 'provisionally_approved' } },
    { label: 'empty response', data: {} },
    { label: 'null payload', data: null },
  ])('fails closed for $label', async ({ data }) => {
    hooks.request.mockResolvedValue(response(data));
    const onSuccess = clickRefresh();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('kyc.statusUnavailable'));
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it.each([401, 410, 503])('does not interpret HTTP %s as approved', async status => {
    hooks.request.mockResolvedValue(response({ status: 'approved' }, status));
    const onSuccess = clickRefresh();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('kyc.statusUnavailable'));
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('does not grant verification on an unavailable network', async () => {
    hooks.request.mockRejectedValue(new Error('network offline'));
    const onSuccess = clickRefresh();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('kyc.statusUnavailable'));
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
