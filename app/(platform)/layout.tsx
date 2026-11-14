import { redirect } from 'next/navigation';
import { currentSession } from '@/lib/session';
import { PlatformHeader } from '@/components/platform/platform-header';
import './platform.css';

export const dynamic = 'force-dynamic';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const session = await currentSession();
  if (!session?.user) redirect('/sign-in');
  return <div className="studio">
    <PlatformHeader name={session.user.name} email={session.user.email} />
    {children}
  </div>;
}
