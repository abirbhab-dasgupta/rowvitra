'use client';

import { useState } from 'react';
import { Check, Copy, FileSpreadsheet } from 'lucide-react';

const orders = [
  ['0007', 'west', '$980'],
  ['0008', 'NORTH', '$3,100'],
  ['0008', 'NORTH', '$3,100'],
];

export function DuplicatePreview() {
  const [clean, setClean] = useState(false);

  return (
    <section className="repair-story" aria-labelledby="repair-heading">
      <div className="story-intro">
        <h2 id="repair-heading">One order.<br />Counted <em>twice.</em></h2>
        <p>Order 0008 appears twice in the sample sales file. Keep both rows and a single wholesale order adds an extra $3,100 to revenue.</p>
        <p>Compare the original rows with the proposed repair before accepting a change in the workspace.</p>
      </div>
      <div className="repair-sheet">
        <div className="sheet-toolbar">
          <div className="sheet-file"><span><FileSpreadsheet size={18} aria-hidden="true" /></span>messy-sales.csv</div>
          <div className="sheet-switch" role="group" aria-label="Sample data view">
            <button aria-pressed={!clean} onClick={() => setClean(false)}>Original rows</button>
            <button aria-pressed={clean} onClick={() => setClean(true)}>Repair preview</button>
          </div>
        </div>
        <div className="sheet-result" aria-live="polite">
          <div>
            <span>Sample revenue</span>
            <strong>{clean ? '$4,080' : '$7,180'}</strong>
            <small>{clean ? '2 rows after repair' : '3 original rows'}</small>
          </div>
          <div className="revenue-strip" aria-hidden="true">
            <i /><i /><i className={clean ? 'excluded' : ''} />
          </div>
        </div>
        <table aria-label="Order comparison, excluded rows are marked removed">
          <thead><tr><th>Order ID</th><th>Region</th><th>Revenue</th></tr></thead>
          <tbody>{orders.map(([id, region, revenue], i) =>
            <tr className={i === 2 ? 'repeat-order' : ''} key={i}>
              <td><span>{id}</span>{i === 2 && <small>{clean ? 'Removed' : 'Duplicate'}</small>}</td>
              <td>{region}</td><td>{clean && i === 2 ? <del>{revenue}</del> : revenue}</td>
            </tr>
          )}</tbody>
        </table>
        <div className="sheet-note">{clean ? <Check size={15} /> : <Copy size={15} />}
          {clean ? 'Duplicate excluded from revenue' : 'Order 0008 appears twice'}
        </div>
      </div>
    </section>
  );
}
