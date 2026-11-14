import {currentSession} from '@/lib/session';
import {AccountSettings} from '@/components/auth/account-settings';
export default async function Page(){const session=await currentSession();return <AccountSettings email={session?.user?.email||''} name={session?.user?.name||''}/>}
