import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BiometricsVerificationModal } from '../src/components/BiometricsVerificationModal';
import { classifyKycRefreshStatus, KYC_STATUS_ENDPOINT } from '../src/lib/kycStatusRefresh';

const request = vi.hoisted(() => vi.fn());
vi.mock('../src/lib/authFetch', () => ({ authFetch: request }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const reply = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
const refresh = () => fireEvent.click(screen.getByRole('button', { name: 'kyc.refresh' }));

beforeEach(() => { request.mockReset(); });

describe('P1 #237 authoritative Didit profile status refresh', () => {
  it('uses only the authenticated server status endpoint and refreshes profile after approved', async () => {
    const onSuccess = vi.fn();
    request.mockResolvedValue(reply({ status: 'approved', isVerified: false }));
    render(<BiometricsVerificationModal isOpen onSuccess={onSuccess} onCancel={vi.fn()} />);
    refresh();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(KYC_STATUS_ENDPOINT).toBe('/api/kyc/status');
    expect(request).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith('/api/kyc/status', { method: 'GET', cache: 'no-store' });
  });

  it.each(['pending', 'review', 'not_started'])(
    'does not grant verification for the server-owned %s state',
    async (status) => {
      const onSuccess = vi.fn();
      request.mockResolvedValue(reply({ status, isVerified: true }));
      render(<BiometricsVerificationModal isOpen onSuccess={onSuccess} onCancel={vi.fn()} />);
      refresh();
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('kyc.photoPending'));
      expect(onSuccess).not.toHaveBeenCalled();
    },
  );

  it.each([
    { status: 'unavailable' },
    { status: 'APPROVED', isVerified: true },
    { isVerified: true },
    { status: true },
    {},
    null,
    [],
  ])('fails closed for non-authoritative payload %j', async (payload) => {
    const onSuccess = vi.fn();
    request.mockResolvedValue(reply(payload));
    render(<BiometricsVerificationModal isOpen onSuccess={onSuccess} onCancel={vi.fn()} />);
    refresh();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('kyc.statusUnavailable'));
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it.each([401, 410, 429, 503])('fails closed on HTTP %s', async (status) => {
    const onSuccess = vi.fn();
    request.mockResolvedValue(reply({ status: 'approved' }, status));
    render(<BiometricsVerificationModal isOpen onSuccess={onSuccess} onCancel={vi.fn()} />);
    refresh();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('kyc.statusUnavailable'));
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('fails closed on network or malformed JSON responses', async () => {
    const onSuccess = vi.fn();
    request.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(new Response('{', { status: 200 }));
    render(<BiometricsVerificationModal isOpen onSuccess={onSuccess} onCancel={vi.fn()} />);
    refresh();
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('kyc.statusUnavailable'));
    refresh();
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('does not display the status dialog or offer a refresh while closed', () => {
    render(<BiometricsVerificationModal isOpen={false} onSuccess={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });
});

describe('strict KYC status contract', () => {
  it('requires only literal approved from the server to report success', () => {
    expect(classifyKycRefreshStatus({ status: 'approved' })).toBe('approved');
    expect(classifyKycRefreshStatus({ isVerified: true })).toBe('unavailable');
    expect(classifyKycRefreshStatus({ status: 'unavailable' })).toBe('unavailable');
    expect(classifyKycRefreshStatus({ status: 'review' })).toBe('pending');
    expect(classifyKycRefreshStatus({ status: 'not_started' })).toBe('pending');
  });
});
