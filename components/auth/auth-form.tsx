'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {ArrowRight,LoaderCircle,Eye,EyeOff} from 'lucide-react';
import {authClient} from '@/lib/auth-client';
export function AuthForm({mode}:{mode:'sign-in'|'sign-up'}){
 const router=useRouter();const [name,setName]=useState('');const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const signup=mode==='sign-up';
 const [visible,setVisible]=useState(false);
 const [remember,setRemember]=useState(true);
 async function submit(e:React.FormEvent){e.preventDefault();setError('');setBusy(true);try{
   const res=signup?await authClient.signUp.email({name,email,password,callbackURL:'/dashboard'}):await authClient.signIn.email({email,password,rememberMe:remember,callbackURL:'/dashboard'});
   if(res.error)throw new Error(res.error.message||'Authentication failed');
   router.push('/dashboard');router.refresh();
 }catch(e){setError(e instanceof Error?e.message:'Unexpected authentication error')}finally{setBusy(false)}}
 async function google(){setError('');try{const result=await authClient.signIn.social({provider:'google',callbackURL:'/dashboard'});if(result.error)throw new Error(result.error.message||'Google sign-in unavailable');}catch(e){setError(e instanceof Error?e.message:'Google sign-in unavailable')}}
 return (
   <section className="access-card" aria-labelledby="access-title">
     <h1 id="access-title">{signup ? 'Create an account' : 'Sign in to Rowvitra'}</h1>
     <form onSubmit={submit}>
       {signup && <div className="access-field">
         <label htmlFor="name">Full name</label>
         <div><input id="name" value={name} onChange={e=>setName(e.target.value)} required minLength={2} autoComplete="name" placeholder="Enter your name" /></div>
       </div>}
       <div className="access-field">
         <label htmlFor="email">Email address</label>
         <div><input id="email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" placeholder="Enter your email" /></div>
       </div>
       <div className="access-field">
         <label htmlFor="password">Password</label>
         <div><input id="password" type={visible?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} autoComplete={signup?'new-password':'current-password'} placeholder={signup?'At least 8 characters':'Enter your password'} />
           <button type="button" aria-label={visible?'Hide password':'Show password'} onClick={()=>setVisible(!visible)}>{visible?<Eye/>:<EyeOff/>}</button>
         </div>
       </div>
       {!signup && <label className="remember-choice"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} />Remember me</label>}
       {error && <div className="error-banner" role="alert">{error}</div>}
       <button className="access-submit" disabled={busy} type="submit">{signup?'Create account':'Sign in'} {busy?<LoaderCircle className="animate-spin"/>:<ArrowRight/>}</button>
     </form>
     <div className="access-divider">or</div>
     <button className="access-google" onClick={google} type="button"><svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.27 5.48-4.8 7.18l7.73 6C44.38 38.03 46.98 31.86 46.98 24.55z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.14.76-4.59l-7.98-6.2A23.8 23.8 0 0 0 0 24c0 3.87.93 7.5 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Continue with Google</button>
     <p className="access-other">{signup?'Already have an account?':'New to Rowvitra?'} <Link href={signup?'/sign-in':'/sign-up'}>{signup?'Sign in':'Create an account'}</Link></p>
   </section>
 );
}
