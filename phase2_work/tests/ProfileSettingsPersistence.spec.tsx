// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProfileSettings } from '../src/screens/ProfileSettings';

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  logout: vi.fn(),
  user: { uid: 'person-1' },
}));
vi.mock('../src/lib/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user, updateProfileData: mocks.save, logOut: mocks.logout }),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('../src/components/BackNavigation', () => ({
  BackNavigation: () => null,
}));
vi.mock('../src/components/InterestsSettings', () => ({
  InterestsSettings: ({
    selectedInterests, onChange,
  }: { selectedInterests: string[]; onChange: (value: string[]) => void }) => (
    <button type="button" onClick={() => onChange([...selectedInterests, 'Musik'])}>
      Add interest
    </button>
  ),
}));

afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('profile settings server-confirmed persistence', () => {
  it('does not call onSave when Firestore confirmation fails, and shows an accessible error', async () => {
    mocks.save.mockRejectedValueOnce(new Error('Permission denied'));
    const onSave = vi.fn();
    render(<ProfileSettings initialInterests={['Lesen']} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add interest' }));
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ interests: ['Lesen', 'Musik'] }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(onSave).not.toHaveBeenCalled();
  });

  it('reports saved values only after authoritative persistence resolves', async () => {
    let complete!: () => void;
    mocks.save.mockImplementationOnce(() => new Promise<void>(resolve => { complete = resolve; }));
    const onSave = vi.fn();
    render(<ProfileSettings initialInterests={['Lesen']} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add interest' }));
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Speichert …' }).hasAttribute('disabled')).toBe(true);
    await act(async () => complete());
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(['Lesen', 'Musik']));
  });

  it('hydrates a replacement authoritative profile without retaining a previous draft', async () => {
    mocks.save.mockResolvedValue(undefined);
    const onSave = vi.fn();
    const { rerender } = render(<ProfileSettings initialInterests={['Lesen']} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add interest' }));
    rerender(<ProfileSettings initialInterests={['Wandern']} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'actions.save' }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ interests: ['Wandern'] }));
  });
});
