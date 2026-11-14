'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, CheckCircle2, FileSpreadsheet, LoaderCircle, UploadCloud } from 'lucide-react';
import Image from 'next/image';

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

  return (
    <main className="app-content dashboard-content">
      <section className="studio-welcome">
        <Image src="/images/landing-hero-art.webp" fill alt="" sizes="(max-width: 760px) 100vw, 1280px" priority />
        <div><h1 className="page-title">Welcome back,<br /><em>{displayName.split(' ')[0]}.</em></h1>
        <p>Upload a CSV or pick up where you left off.</p></div>
      </section>
      <div className="studio-datasets">
          <section className="dashboard-section" aria-labelledby="upload-heading">
            <div className="section-heading"><h2 id="upload-heading">Upload a dataset</h2></div>
            <form className={`upload-zone${dragging ? ' dragging' : ''}`} onSubmit={upload} onDragOver={e => {e.preventDefault();setDragging(true);}} onDragLeave={e => {e.preventDefault();setDragging(false);}} onDrop={e => {e.preventDefault();setDragging(false);selectFile(e.dataTransfer.files?.[0] ?? null);}}>
              <label className="dataset-picker" htmlFor="csv-upload">
                {file ? <CheckCircle2 size={21} aria-hidden="true" /> : <UploadCloud size={21} aria-hidden="true" />}
                <span className="picker-copy" aria-live="polite">
                  <strong>{file ? file.name : 'Drop your CSV here'}</strong>
                  <small>{file ? (file.size / 1024).toFixed(1) + ' KB' : 'Up to 1.5 MB'}</small>
                </span>
                <span className="picker-browse">{file ? 'Replace' : 'Browse'}</span>
                <input id="csv-upload" type="file" className="visually-hidden" accept=".csv,text/csv" aria-label="Choose CSV file" onChange={e => selectFile(e.target.files?.[0] ?? null)} />
              </label>
              <label className="label upload-goal-label" htmlFor="analysis-goal">Analysis goal <span className="subtle">(optional)</span></label>
              <input id="analysis-goal" className="field upload-goal" value={goal} onChange={e => setGoal(e.target.value)} maxLength={240} placeholder="Example: Monthly revenue by region" />
              <button className="button-dark upload-submit" disabled={!file || busy} type="submit">{busy && <LoaderCircle size={15} className="animate-spin" />} {busy ? 'Analyzing your data...' : 'Upload and diagnose'}</button>
              {error && <div className="error-banner upload-error" role="alert">{error}</div>}
            </form>
          </section>
          <section className="dashboard-section" aria-labelledby="recent-heading">
            <div className="section-heading"><h2 id="recent-heading">Recent datasets <span className="badge">{items.length}</span></h2></div>
            {loading ? <div className="dashboard-skeleton" aria-label="Loading datasets" /> : items.length ?
              <ul className="recent-files">{items.map(item => <li key={item.id}>
                <Link className="recent-file" href={`/workspace/${item.id}`}>
                  <span className="dataset-document" aria-hidden="true">CSV</span>
                  <span className="recent-file-copy"><strong>{item.name}</strong>{item.goal && <small>{item.goal}</small>}</span>
                  <time dateTime={item.updatedAt} title={new Date(item.updatedAt).toLocaleString()}>Updated {new Date(item.updatedAt).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</time>
                  <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              </li>)}</ul> :
              <div className="no-content dashboard-empty"><FileSpreadsheet size={28} color="#af9f92" aria-hidden="true" /><h3>No datasets yet.</h3><p className="subtle small">Your first dataset will appear here once uploaded.</p></div>}
          </section>
      </div>
    </main>
  );
}
