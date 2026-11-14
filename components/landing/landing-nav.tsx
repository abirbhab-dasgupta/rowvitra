'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';

export function LandingNav() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    function onEscape(event: KeyboardEvent) { if (event.key === 'Escape') setOpen(false); }
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [open]);
  return (
    <header className="land-header">
      <Link href="/" className="rv-brand" aria-label="Rowvitra home"><span className="rv-brand-mark" aria-hidden="true"><i /><i /></span>Rowvitra</Link>
      <nav className="land-nav" aria-label="Main navigation">
        <Link href="/#product">Product</Link>
        <Link href="/#flow">Features</Link>
        <Link href="/#exports">Exports</Link>
        <Link href="/pricing">Pricing</Link>
      </nav>
      <div className="land-header-actions">
        <Link className="login-text" href="/sign-in">Log in</Link>
        <Link className="button-dark" href="/sign-up">Start Exploring <ArrowRight size={16} aria-hidden="true" /></Link>
      </div>
      <button className="land-menu" type="button" onClick={() => setOpen(current => !current)} aria-expanded={open} aria-controls="landing-mobile-nav" aria-label={open ? 'Close navigation' : 'Open navigation'}>
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      <nav id="landing-mobile-nav" className={`land-mobile-nav${open ? ' is-open' : ''}`} aria-label="Mobile navigation" inert={!open}>
        <Link href="/#product" onClick={() => setOpen(false)}>Product</Link>
        <Link href="/#flow" onClick={() => setOpen(false)}>Features</Link>
        <Link href="/#exports" onClick={() => setOpen(false)}>Exports</Link>
        <Link href="/pricing" onClick={() => setOpen(false)}>Pricing</Link>
        <Link href="/sign-in" onClick={() => setOpen(false)}>Log in</Link>
        <Link className="button-dark" href="/sign-up" onClick={() => setOpen(false)}>Start Exploring <ArrowRight size={16} /></Link>
      </nav>
    </header>
  );
}
