'use client';

import Image from 'next/image';

import { useRef, useState } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';

const stages = [
  { label: 'Messy Data', image: 'messy', detail: 'Three orders use different spellings for the same region.', values: ['North', 'NORTH', 'north␣'] },
  { label: 'AI Cleaning', image: 'clean', detail: 'Trim the trailing space and standardize the region label. The order amounts stay intact.', values: ['North', 'North', 'North'] },
  { label: 'Visualize', image: 'visual', detail: 'Group revenue by month to see how these three North orders compare.' },
  { label: 'Reliable Insights', image: 'insights', detail: 'Across these three orders, North generated $3,590 in revenue. January contributed 58%.' },
];

export function LandingFlow() {
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = stages[index];
  return (
    <div className="flow-icons">
      {stages.map((item, i) => (
        <div className="flow-icon" key={item.image}>
          <button className="stage-trigger" aria-haspopup="dialog" onClick={() => {
            setIndex(i);
            dialog.current?.showModal();
          }}>
            <Image src={`/images/flow-${item.image}.webp`} width={135} height={115} alt="" />
            <strong>{item.label}</strong>
          </button>
          {i < stages.length - 1 && <ArrowRight className="flow-arrow" size={19} aria-hidden="true" />}
        </div>
      ))}
      <dialog ref={dialog} className="stage-dialog" aria-labelledby="stage-title" onClick={event => {
        if (event.target === dialog.current) dialog.current.close();
      }}>
        <div className="stage-panel">
          <button autoFocus type="button" className="stage-close" aria-label="Close example" onClick={() => dialog.current?.close()}><X size={19} /></button>
          <div aria-live="polite">
            <h2 id="stage-title">{stage.label}</h2>
            <p>{stage.detail}</p>
            {stage.values ? <table><thead><tr><th>Order</th><th>Region</th><th>Revenue</th></tr></thead>
              <tbody>{stage.values.map((value, i) => <tr key={i}><td>000{i + 1}</td><td>{value}</td><td>{['$1,200', '$890', '$1,500'][i]}</td></tr>)}</tbody></table>
              : index === 2 ? <div className="sample-bars">{[['Jan', '$2,090', '100%'], ['Feb', '$1,500', '71.8%']].map(([month, sum, width]) =>
                <div key={month}><span>{month}</span><i style={{ width }} /><strong>{sum}</strong></div>)}</div>
              : <div className="sample-total"><strong>$3,590</strong><span>North · January–February</span></div>}
          </div>
          {index < stages.length - 1 ? <button type="button" className="button-dark" onClick={() => setIndex(index + 1)}>{stages[index + 1].label}<ArrowRight size={16} /></button> :
            <button type="button" className="button-dark" onClick={() => dialog.current?.close()}>Finish walkthrough <Check size={16} /></button>}
        </div>
      </dialog>
    </div>
  );
}
