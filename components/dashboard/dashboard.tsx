'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowUpRight, CheckCircle2, Database, FileSpreadsheet, LoaderCircle, LogOut, PlayCircle, Settings2, UploadCloud } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

type DatasetSummary = { id: string; name: string; goal: string; createdAt: string; updatedAt: string };
const MAX_UPLOAD_BYTES = 1_500_000;

export function Dashboard({ displayName }: { displayName: string }) {
  const router = useRouter();
  const [items, setItems] = useState<DatasetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [goal, setGoal] = useState('');
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/datasets', { signal: controller.signal })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Unable to load datasets');
        setItems(body.datasets || []);
      })
      .catch(err => { if (err.name !== 'AbortError') setError(err.message || 'Unable to load datasets'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  function selectFile(candidate: File | null) {
    setError('');
    if (!candidate) { setFile(null); return; }
    if (!candidate.name.toLowerCase().endsWith('.csv')) { setError('Only CSV files are supported.'); setFile(null); return; }
    if (candidate.size > MAX_UPLOAD_BYTES) { setError('The CSV must be smaller than 1.5 MB.'); setFile(null); return; }
    if (candidate.size === 0) { setError('Please select a nonempty CSV file.'); setFile(null); return; }
    setFile(candidate);
  }

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('goal', goal);
      const response = await fetch('/api/datasets', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Upload failed');
      router.push(`/workspace/${result.id}`);
    } catch (err) { setError(err instanceof Error ? err.message : 'Upload failed'); }
    finally { setBusy(false); }
  }

  async function signOut() {
    await authClient.signOut();
    router.push('/sign-in');
    router.refresh();
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link href="/" className="rv-brand"><span className="rv-brand-mark" aria-hidden="true"><i /><i /></span>Rowvitra</Link>
        <span className="sidebar-caption">YOUR DATA STUDIO</span>
        <nav className="sidebar-nav" aria-label="Workspace navigation">
          <Link className="active" href="/dashboard"><Database size={18} /> My datasets</Link>
          <Link href="/demo"><PlayCircle size={18} /> Sample workspace</Link>
          <Link href="/settings"><Settings2 size={18} /> Account settings</Link>
        </nav>
        <div className="sidebar-bottom"><p>Signed in as <strong>{displayName}</strong></p><button className="thin-button" onClick={signOut}><LogOut size={14} aria-hidden="true" /> Sign out</button></div>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <span className="micro-label">WORKSPACE / OVERVIEW</span>
          <span className="badge">PERSONAL WORKSPACE</span>
        </header>
        <nav className="dashboard-mobile-nav" aria-label="Mobile workspace navigation">
          <Link href="/dashboard">My datasets</Link><Link href="/demo">Sample</Link><Link href="/settings">Settings</Link><button onClick={signOut}>Sign out</button>
        </nav>
        <main className="app-content dashboard-content">
          <div className="dashboard-intro">
            <div>
              <span className="micro-label">YOUR DATA, UNDER CONTROL</span>
              <h1 className="page-title">Welcome back,<br /><em>{displayName.split(' ')[0]}.</em></h1>
              <p className="subtle dashboard-lead">Diagnose what matters. Repair with evidence. Create clear, meaningful visualizations.</p>
            </div>
            <div className="dashboard-identity" aria-hidden="true"><span className="dashboard-identity-ring" /><span className="dashboard-identity-bar" /><span className="dashboard-identity-bar" /><span className="dashboard-identity-bar" /></div>
          </div>
          <section className="dashboard-section" aria-labelledby="upload-heading">
            <div className="section-heading"><h2 id="upload-heading">Start something new.</h2><span className="badge orange">CSV FILES · 1.5 MB MAX</span></div>
            <form className={`upload-zone${dragging ? ' dragging' : ''}`} onSubmit={upload} onDragOver={e => {e.preventDefault();setDragging(true);}} onDragLeave={e => {e.preventDefault();setDragging(false);}} onDrop={e => {e.preventDefault();setDragging(false);selectFile(e.dataTransfer.files?.[0] ?? null);}}>
              <div className="upload-icon"><UploadCloud size={28} aria-hidden="true" /></div>
              <h3>Bring your messy data.</h3>
              <p className="subtle">Drag a CSV here or choose a file to begin.</p>
              <label className="upload-select" htmlFor="csv-upload">Choose CSV file <ArrowUpRight size={15} aria-hidden="true" /></label>
              <input id="csv-upload" type="file" className="visually-hidden" accept=".csv,text/csv" onChange={e => selectFile(e.target.files?.[0] ?? null)} />
              {file && <p className="upload-file"><CheckCircle2 size={15} aria-hidden="true" /> {file.name} <span>({(file.size / 1024).toFixed(1)} KB)</span></p>}
              <label className="label upload-goal-label" htmlFor="analysis-goal">YOUR ANALYSIS GOAL <span className="subtle">(OPTIONAL)</span></label>
              <input id="analysis-goal" className="field upload-goal" value={goal} onChange={e => setGoal(e.target.value)} maxLength={240} placeholder="Example: Monthly revenue by region" />
              <button className="button-dark upload-submit" disabled={!file || busy} type="submit">{busy ? <LoaderCircle size={16} className="animate-spin" /> : <UploadCloud size={16} />} {busy ? 'Analyzing your data...' : 'Upload and diagnose'} <ArrowRight size={16} /></button>
              {error && <div className="error-banner upload-error" role="alert">{error}</div>}
            </form>
          </section>
          <section className="dashboard-section" aria-labelledby="recent-heading">
            <div className="section-heading"><h2 id="recent-heading">Recent datasets <span className="badge">{items.length}</span></h2><Link className="thin-button" href="/demo">Explore the sample <ArrowUpRight size={14} /></Link></div>
            {loading ? <div className="dashboard-skeleton" aria-label="Loading datasets" /> : items.length ?
              <div className="dataset-grid">{items.map(item => <Link className="dataset-card" href={`/workspace/${item.id}`} key={item.id}>
                <div className="dataset-card-icon"><FileSpreadsheet size={24} aria-hidden="true" /></div>
                <strong>{item.name}</strong>
                <p className="subtle small">{item.goal || 'Ready for analysis'}</p>
                <div className="row between"><span className="subtle small">Updated {new Date(item.updatedAt).toLocaleDateString()}</span><ArrowUpRight size={18} /></div>
              </Link>)}</div> :
              <div className="no-content dashboard-empty"><FileSpreadsheet size={28} color="#af9f92" aria-hidden="true" /><h3>No datasets yet.</h3><p className="subtle small">Your first dataset will appear here once uploaded.</p><Link href="/demo" className="thin-button">See a sample workspace <ArrowRight size={13} /></Link></div>}
          </section>
        </main>
      </div>
    </div>
  );
}
