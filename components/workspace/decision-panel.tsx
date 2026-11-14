'use client';

import { useMemo, useState } from 'react';
import { PlotlyChart } from './plotly-chart';
import type { ChartPoint, ColumnProfile } from './types';

type Selection = {goal:'highest'|'lowest'; aggregation:'sum'|'mean'; metric:string; group:string};
type Scenario = {name:string; eligible:number; groups:number; winners:string[]; winnerCount:number; points:(ChartPoint & {rank:number})[]};
type CriticalRow = {rowId:string; group:string; issues:string[]; before:number; after:number|null; rank:number; afterRank:number|null; effect:number; originalValues:Record<string,string>|null; currentValues:Record<string,string>};
export type DecisionResult = {status:'Stable'|'Unstable'|'Inconclusive'; reason:string; assumptions:string[]; scenarios:Scenario[]; critical:{count:number;examined:number;rows:CriticalRow[]}};
const format = (value:number) => value.toLocaleString(undefined,{maximumSignificantDigits:10});

export function DecisionPanel({columns,run,inspect,interpret}:{
  columns:ColumnProfile[]; run:(spec:Selection)=>Promise<DecisionResult>; inspect:(id:string)=>void;
  interpret?:(question:string)=>Promise<Selection>;
}){
  const metrics=columns.filter(c=>!c.protected && ['number','mixed'].includes(c.type));
  const firstMetric=metrics[0]?.name||'';
  const [spec,setSpec]=useState<Selection>({goal:'highest',aggregation:'sum',metric:firstMetric,
    group:columns.find(c=>c.type==='text' && c.name!==firstMetric)?.name||columns.find(c=>c.name!==firstMetric)?.name||''});
  const [result,setResult]=useState<DecisionResult|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [question,setQuestion]=useState('');
  const [left,setLeft]=useState(0);
  const [right,setRight]=useState(1);
  const comparison=useMemo(()=>{
    if(!result)return null;
    const series=[result.scenarios[left],result.scenarios[right]].map(s=>({name:s.name,points:s.points}));
    return {type:'comparison',title:`${spec.aggregation==='sum'?'Total':'Average'} ${spec.metric} by ${spec.group}`,series};
  },[result,left,right,spec]);
  function change(next:Partial<Selection>){setSpec({...spec,...next});setResult(null);setError('')}
  async function analyze(){
    setBusy(true);setResult(null);setError('');
    try{setResult(await run(spec));setLeft(0);setRight(1)}
    catch(e){setError(e instanceof Error?e.message:'Analysis failed')}
    finally{setBusy(false)}
  }
  async function interpretQuestion(){
    if(!interpret)return;
    setBusy(true);setError('');
    try{change(await interpret(question))}
    catch(e){setError(e instanceof Error?e.message:'Question interpretation failed')}
    finally{setBusy(false)}
  }
  return <div className="stack decision-tools">
    <section className="panel"><div className="section-heading"><h2>Decision Stability Simulator</h2></div>
      {interpret&&<details><summary>Choose settings from a question with Gemini</summary><div className="row wrap">
        <input className="field" aria-label="Analytical question" maxLength={240} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Which region has the highest average revenue?"/>
        <button className="button-line" disabled={busy||!question.trim()} onClick={interpretQuestion}>Interpret question</button></div></details>}
      <fieldset disabled={busy} className="decision-fields">
        <label>Analytical goal<select className="field" value={spec.goal} onChange={e=>change({goal:e.target.value as Selection['goal']})}><option value="highest">Find highest-ranked groups</option><option value="lowest">Find lowest-ranked groups</option></select></label>
        <label>Calculation<select className="field" value={spec.aggregation} onChange={e=>change({aggregation:e.target.value as Selection['aggregation']})}><option value="sum">Total</option><option value="mean">Average</option></select></label>
        <label>Metric<select className="field" value={spec.metric} onChange={e=>change({metric:e.target.value,group:spec.group===e.target.value?columns.find(c=>c.name!==e.target.value)?.name||'':spec.group})}>{metrics.map(c=><option key={c.name}>{c.name}</option>)}</select></label>
        <label>Group by<select className="field" value={spec.group} onChange={e=>change({group:e.target.value})}>{columns.filter(c=>c.name!==spec.metric).map(c=><option key={c.name}>{c.name}</option>)}</select></label>
      </fieldset>
      {(!spec.metric||!spec.group)&&<p className="subtle">Select a dataset with a numeric metric and a separate grouping column.</p>}
      <button className="button-dark" disabled={busy||!spec.metric||!spec.group} onClick={analyze}>{busy?'Working…':'Run simulation'}</button>
      {error&&<p role="alert" className="error-banner">{error}</p>}
    </section>
    {result&&<>
      <section className="panel"><div className="section-heading"><h2>Ranking stability</h2><strong className={'badge '+(result.status==='Stable'?'green':'orange')}>{result.status}</strong></div>
        <p>{result.reason}</p>
        <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Scenario</th><th>First place</th><th>Eligible rows</th><th>Groups</th></tr></thead><tbody>{result.scenarios.map(s=><tr key={s.name}><td>{s.name}</td><td>{s.winners.join(', ')||'No eligible groups'}{s.winnerCount>s.winners.length?` (+${s.winnerCount-s.winners.length})`:''}</td><td>{s.eligible}</td><td>{s.groups}</td></tr>)}</tbody></table></div>
        <div className="decision-fields">{[{label:'Compare',value:left,set:setLeft},{label:'With',value:right,set:setRight}].map(control=><label key={control.label}>{control.label}<select className="field" value={control.value} onChange={e=>control.set(Number(e.target.value))}>{result.scenarios.map((s,i)=><option key={s.name} value={i}>{s.name}</option>)}</select></label>)}</div>
        <PlotlyChart chart={comparison}/>
        <details open><summary>Simulation assumptions</summary><ul>{result.assumptions.map(a=><li key={a}>{a}</li>)}</ul></details>
      </section>
      <section className="panel"><div className="section-heading"><h2>Decision-Critical Row Finder</h2></div>
        <p className="small subtle">{result.critical.examined} suspicious eligible records checked individually. {result.critical.count} meet the impact threshold.</p>
        <div className="issue-list">{result.critical.rows.map(r=><article className="issue-item" key={r.rowId}>
          <div className="row between wrap"><strong>Row {r.rowId} · {r.group}</strong><span className="badge">Impact {format(r.effect)}</span></div>
          <p>{r.issues.join(' · ')}</p><p>Excluding this row changes the group score from {format(r.before)} to {r.after===null?'no observations':format(r.after)}. Rank {r.rank} → {r.afterRank??'absent'}.</p>
          <details><summary>Original and current values</summary>{!r.originalValues&&<p>Original row mapping unavailable.</p>}<div className="data-table-wrap"><table className="data-table"><thead><tr><th>Column</th><th>Original upload</th><th>Current version</th></tr></thead><tbody>{Array.from(new Set([...Object.keys(r.originalValues||{}),...Object.keys(r.currentValues)])).map(k=><tr key={k}><th>{k}</th><td>{r.originalValues?.[k]??'—'}</td><td>{r.currentValues[k]??'—'}</td></tr>)}</tbody></table></div></details>
          <button className="button-line" onClick={()=>inspect(r.rowId)}>Inspect row {r.rowId} in Data Editor</button>
        </article>)}</div>
      </section>
    </>}
  </div>;
}
