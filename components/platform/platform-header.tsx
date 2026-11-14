'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ChevronDown, LogOut, Settings2 } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

type Profile = { name: string; email: string };

function ProfilePopup({ name, email }: Profile) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const initials = name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase() || email[0]?.toUpperCase();

  async function signOut() {
    setBusy(true);
    setError('');
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message || 'Unable to sign out.');
      window.location.replace('/sign-in');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign out. Please try again.');
      setBusy(false);
    }
  }

  return <div className="studio-account">
    <button type="button" popoverTarget="studio-profile" className="studio-profile-trigger" aria-label="Open your profile">
      <span className="studio-avatar">{initials}</span><ChevronDown size={14} aria-hidden="true" />
    </button>
    <div id="studio-profile" popover="auto" className="studio-popup" aria-label="Your profile">
      <strong>{name}</strong><p>{email}</p>
      <Link href="/settings" onClick={e => e.currentTarget.closest<HTMLElement>('[popover]')?.hidePopover()}><Settings2 size={16} />Account settings</Link>
      <button onClick={signOut} disabled={busy}><LogOut size={16} />{busy ? 'Signing out…' : 'Sign out'}</button>
      {error && <p role="alert">{error}</p>}
    </div>
  </div>;
}

export function PlatformHeader(profile: Profile) {
  const path = usePathname();
  return <header className="studio-header">
    <Link href="/dashboard" className="rv-brand" aria-label="Rowvitra dashboard"><span className="rv-brand-mark" aria-hidden="true"><i/><i/></span>Rowvitra</Link>
    <nav aria-label="Main navigation"><Link href="/dashboard" aria-current={path === '/dashboard' ? 'page' : undefined}>Datasets</Link><Link href="/settings" aria-current={path === '/settings' ? 'page' : undefined}>Settings</Link></nav>
    <ProfilePopup key={path} {...profile} />
  </header>;
}
