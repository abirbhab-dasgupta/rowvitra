import Link from 'next/link';
import { AuthSculpture } from '@/components/auth/auth-sculpture';
import { ArrowLeft } from 'lucide-react';
import './auth.css';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-scene">
      <header className="auth-top">
        <Link href="/" className="rv-brand" aria-label="Rowvitra home">
          <span className="rv-brand-mark" aria-hidden="true"><i /><i /></span>Rowvitra
        </Link>
        <Link href="/" className="return-link"><ArrowLeft size={15} strokeWidth={1.5} aria-hidden="true" />Home</Link>
      </header>
      <main className="auth-columns">
        <aside className="auth-story">
          <p className="story-title">Turn raw data<br />into reliable <em>insights.</em></p>
          <AuthSculpture />
        </aside>
        <div className="auth-panel">{children}</div>
      </main>
    </div>
  );
}
