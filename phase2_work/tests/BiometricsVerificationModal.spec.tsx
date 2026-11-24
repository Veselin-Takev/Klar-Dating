import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BiometricsVerificationModal } from '../src/components/BiometricsVerificationModal';

const mocks = vi.hoisted(() => ({
  request: vi.fn(async (_path: string): Promise<Response> => new Response('{}')),
}));

vi.mock('../src/lib/authFetch', () => ({ authFetch: mocks.request }));
vi.mock('../src/lib/useModalAccessibility', () => ({
  useModalAccessibility: () => ({ dialogRef: { current: null }, onKeyDown: vi.fn() }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});
const renderModal = () => {
  const onSuccess = vi.fn();
  render(<BiometricsVerificationModal isOpen onSuccess={onSuccess} onCancel={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'kyc.refresh' }));
  return onSuccess;
};

beforeEach(() => {
  mocks.request.mockReset();
  mocks.request.mockResolvedValue(jsonResponse({ status: 'pending' }));
});

describe('Profile verification refresh uses the canonical KYC status contract', () => {
  it('accepts only the authoritative approved status', async () => {
    mocks.request.mockResolvedValueOnce(jsonResponse({ status: 'approved' }));
    const onSuccess = renderModal();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(mocks.request).toHaveBeenCalledWith('/api/kyc/status');
  });

  it.each(['pending', 'review', 'not_started'])('keeps %s unverified', async status => {
    mocks.request.mockResolvedValueOnce(jsonResponse({ status }));
    const onSuccess = renderModal();
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('kyc.photoPending'));
    expect(onSuccess).not.toHaveBeenCalled();
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(mocks.request).toHaveBeenCalledWith('/api/kyc/status');
  });

  it('fails closed for an explicit unavailable status', async () => {
    mocks.request.mockResolvedValueOnce(jsonResponse({ status: 'unavailable' }));
    const onSuccess = renderModal();
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('kyc.statusUnavailable'));
    expect(onSuccess).not.toHaveBeenCalled();
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(mocks.request).toHaveBeenCalledWith('/api/kyc/status');
  });

  it.each([{}, { isVerified: true }, { status: 'verified' }, { status: null }])(
    'fails closed for malformed or unknown status payloads',
    async payload => {
      mocks.request.mockResolvedValueOnce(jsonResponse(payload));
      const onSuccess = renderModal();
      await waitFor(() => expect(screen.getByRole('status').textContent).toBe('kyc.statusUnavailable'));
      expect(onSuccess).not.toHaveBeenCalled();
      expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(mocks.request).toHaveBeenCalledWith('/api/kyc/status');
    },
  );

  it('does not accept approved data from a non-2xx response', async () => {
    mocks.request.mockResolvedValueOnce(jsonResponse({ status: 'approved' }, 503));
    const onSuccess = renderModal();
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('kyc.statusUnavailable'));
    expect(onSuccess).not.toHaveBeenCalled();
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(mocks.request).toHaveBeenCalledWith('/api/kyc/status');
  });

  it('never calls the retired verification-status endpoint', async () => {
    mocks.request.mockResolvedValueOnce(jsonResponse({ status: 'pending' }));
    const onSuccess = renderModal();
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('kyc.photoPending'));
    expect(onSuccess).not.toHaveBeenCalled();
    expect(mocks.request.mock.calls.map(([path]) => path)).toEqual(['/api/kyc/status']);
  });
});
