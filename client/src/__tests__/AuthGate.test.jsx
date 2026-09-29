import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import AuthGate from '../components/AuthGate';

vi.mock('../lib/firebase', () => ({
  signInWithGoogle: vi.fn()
}));

describe('AuthGate', () => {
  it('explains that credentials stay local instead of being synced to Firestore', () => {
    render(<AuthGate onSignInError={vi.fn()} />);

    expect(screen.getByText(/AI provider keys and SMTP passwords stay encrypted on this device/i)).toBeInTheDocument();
    expect(screen.getByText(/Credentials are encrypted locally and never synced to Firestore/i)).toBeInTheDocument();
  });
});
