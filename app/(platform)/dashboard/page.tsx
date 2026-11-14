import {currentSession} from '@/lib/session';
import {Dashboard} from '@/components/dashboard/dashboard';
export default async function Page(){const session=await currentSession();return <Dashboard displayName={session?.user?.name||'Analyst'}/>}
