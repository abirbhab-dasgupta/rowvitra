'use client';
import {useState} from 'react';


import {authClient} from '@/lib/auth-client';

export function AccountSettings({email,name}:{email:string;name:string}){
 const [current,setCurrent]=useState('');const [next,setNext]=useState('');const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');
 async function change(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage('');setError('');try{const r=await authClient.changePassword({currentPassword:current,newPassword:next,revokeOtherSessions:true});if(r.error)throw new Error(r.error.message);setMessage('Password updated. Other sessions were revoked.');setCurrent('');setNext('');}catch(e){setError(e instanceof Error?e.message:'Cannot change password. Google-only accounts may not have a password.')}finally{setBusy(false)}}
 return <main className="app-content studio-settings">
   <h1 className="page-title">Account <em>settings.</em></h1>
   <section className="settings-row">
     <h2>Profile</h2>
     <dl><dt>Name</dt><dd>{name}</dd><dt>Email address</dt><dd>{email}</dd></dl>
   </section>
   <section className="settings-row">
     <div><h2>Change password</h2><p>For accounts that sign in with email and password.</p></div>
     <form onSubmit={change}>
       <label htmlFor="current-password">Current password</label>
       <input id="current-password" className="field" type="password" autoComplete="current-password" minLength={8} required value={current} onChange={e=>setCurrent(e.target.value)} />
       <label htmlFor="new-password">New password</label>
       <input id="new-password" className="field" type="password" autoComplete="new-password" minLength={8} required value={next} onChange={e=>setNext(e.target.value)} />
       {error&&<div role="alert" className="error-banner">{error}</div>}
       {message&&<div role="status" className="success-banner">{message}</div>}
       <button className="button-dark" disabled={busy}>{busy?'Updating…':'Update password'}</button>
     </form>
   </section>
 </main>;
}
