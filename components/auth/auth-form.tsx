'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {ArrowRight,LoaderCircle} from 'lucide-react';
import {authClient} from '@/lib/auth-client';
export function AuthForm({mode}:{mode:'sign-in'|'sign-up'}){
 const router=useRouter();const [name,setName]=useState('');const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const signup=mode==='sign-up';
 async function submit(e:React.FormEvent){e.preventDefault();setError('');setBusy(true);try{
   const res=signup?await authClient.signUp.email({name,email,password,callbackURL:'/dashboard'}):await authClient.signIn.email({email,password,callbackURL:'/dashboard'});
   if(res.error)throw new Error(res.error.message||'Authentication failed');
   router.push('/dashboard');router.refresh();
 }catch(e){setError(e instanceof Error?e.message:'Unexpected authentication error')}finally{setBusy(false)}}
 async function google(){setError('');try{const result=await authClient.signIn.social({provider:'google',callbackURL:'/dashboard'});if(result.error)throw new Error(result.error.message||'Google sign-in unavailable');}catch(e){setError(e instanceof Error?e.message:'Google sign-in unavailable')}}
 return <div className="auth-form"><span className="micro-label">{signup?'CREATE YOUR WORKSPACE':'WELCOME BACK'}</span><h2>{signup?'Start with clarity.':'Welcome back.'}</h2><p>{signup?'Create your account and turn messy datasets into useful insights.':'Access your datasets, repair history, and visualizations.'}</p>
 <form onSubmit={submit}>{signup&&<div><label htmlFor="name">Full name</label><input id="name" className="field" value={name} onChange={e=>setName(e.target.value)} required minLength={2} autoComplete="name" placeholder="Your name"/></div>}
 <label htmlFor="email">Email address</label><input id="email" type="email" className="field" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com"/>
 <label htmlFor="password">Password</label><input id="password" type="password" className="field" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} autoComplete={signup?'new-password':'current-password'} placeholder="At least 8 characters"/>
 {error&&<div className="error-banner" role="alert" style={{marginBottom:14}}>{error}</div>}
 <button className="button-dark" disabled={busy} type="submit">{busy?<LoaderCircle size={16} className="animate-spin"/>:signup?'Create account':'Sign in'} <ArrowRight size={17}/></button></form>
 <div className="auth-divider">or continue with</div><button className="oauth-button" onClick={google} type="button"><svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.27 5.48-4.8 7.18l7.73 6C44.38 38.03 46.98 31.86 46.98 24.55z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.14.76-4.59l-7.98-6.2A23.8 23.8 0 0 0 0 24c0 3.87.93 7.5 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>Continue with Google</button>
 <p style={{textAlign:'center',marginTop:23}}>{signup?'Already have an account?':'New to Rowvitra?'} <Link style={{fontWeight:800,textDecoration:'underline'}} href={signup?'/sign-in':'/sign-up'}>{signup?'Sign in':'Create an account'}</Link></p>
 </div>
}
