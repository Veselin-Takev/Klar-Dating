// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EinwilligungUndAlter } from './EinwilligungUndAlter';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: 'de' },
  }),
}));
vi.mock('../lib/AuthContext', () => ({
  useAuth: () => ({
    refreshProfile: async () => null,
    user: { uid: 'example-uid', isAnonymous: false },
  }),
}));
vi.mock('../lib/api', () => ({ getAuthToken: async () => 'test-token' }));
vi.mock('./LanguageSwitcher', () => ({ LanguageSwitcher: () => <div>Deutsch</div> }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function enterDate(day: string, month: string, year: string) {
  fireEvent.change(screen.getByRole('textbox', { name: 'ageGate.dayLabel' }), {
    target: { value: day },
  });
  fireEvent.change(screen.getByRole('combobox', { name: 'ageGate.monthLabel' }), {
    target: { value: month },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'ageGate.yearLabel' }), {
    target: { value: year },
  });
}

describe('mobile accessible age gate', () => {
  it('offers properly labelled direct fields and a native calendar alternative', () => {
    render(<EinwilligungUndAlter />);
    expect(screen.getByRole('group', { name: 'ageGate.birthdateLabel' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'ageGate.dayLabel' })).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByRole('textbox', { name: 'ageGate.yearLabel' })).toHaveAttribute('autocomplete', 'bday-year');
    expect(screen.getByRole('combobox', { name: 'ageGate.monthLabel' })).toBeInTheDocument();
    enterDate('10', '11', '2000');
    fireEvent.click(screen.getByRole('button', { name: 'ageGate.useCalendar' }));
    expect(screen.getByLabelText('ageGate.birthdateLabel')).toHaveValue('2000-11-10');
    fireEvent.click(screen.getByRole('button', { name: 'ageGate.useDirect' }));
    expect(screen.getByRole('textbox', { name: 'ageGate.yearLabel' })).toHaveValue('2000');
  });

  it('does not submit an invalid date or make an age decision in the browser', async () => {
    const fetchStub = vi.fn();
    vi.stubGlobal('fetch', fetchStub);
    render(<EinwilligungUndAlter />);
    enterDate('31', '02', '2000');
    fireEvent.click(screen.getByRole('button', { name: 'ageGate.next' }));
    expect(screen.getByRole('alert')).toHaveTextContent('ageGate.errorInvalid');
    expect(screen.getByRole('textbox', { name: 'ageGate.dayLabel' })).toHaveAttribute('aria-invalid', 'true');
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it('keeps the date and reports backend outage without falsely flagging the date as invalid', async () => {
    const fetchStub = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => ({
      ok: false, status: 503, json: async () => ({ code: 'api_backend_unavailable' }),
    }));
    vi.stubGlobal('fetch', fetchStub);
    render(<EinwilligungUndAlter />);
    enterDate('10', '11', '2000');
    fireEvent.click(screen.getByRole('button', { name: 'ageGate.next' }));
    await waitFor(() => expect(fetchStub).toHaveBeenCalledTimes(1));
    const [url, init] = fetchStub.mock.calls[0];
    expect(url).toBe('/api/account/alter');
    expect(JSON.parse(init?.body as string)).toEqual({ geburtsdatum: '2000-11-10' });
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer test-token');
    expect(await screen.findByRole('alert')).toHaveTextContent('ageGate.errorService');
    expect(screen.getByRole('textbox', { name: 'ageGate.yearLabel' })).toHaveValue('2000');
    expect(screen.getByRole('textbox', { name: 'ageGate.dayLabel' })).toHaveAttribute('aria-invalid', 'false');
    expect(screen.queryByText('consentGate.title')).not.toBeInTheDocument();
  });

  it('does not advance to consent based only on an unverified success JSON response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200, json: async () => ({ ok: true, isAdult: true }),
    })));
    render(<EinwilligungUndAlter />);
    enterDate('10', '11', '2000');
    fireEvent.click(screen.getByRole('button', { name: 'ageGate.next' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('ageGate.errorGeneric');
    expect(screen.queryByText('consentGate.title')).not.toBeInTheDocument();
  });
});
