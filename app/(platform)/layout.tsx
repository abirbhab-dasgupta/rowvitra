import {redirect} from 'next/navigation';
import {currentSession} from '@/lib/session';
export const dynamic='force-dynamic';
export default async function Layout({children}:{children:React.ReactNode}){const session=await currentSession();if(!session?.user)redirect('/sign-in');return children;}
