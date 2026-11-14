'use client';

import Image from 'next/image';
import type { PointerEvent } from 'react';

export function AuthSculpture() {
  function tilt(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || !window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
    const frame = event.currentTarget;
    const bounds = frame.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    frame.style.setProperty('--tilt-x', (-4 * y) + 'deg');
    frame.style.setProperty('--tilt-y', (6 * x) + 'deg');
  }

  return (
    <div className="auth-sculpture" onPointerMove={tilt} onPointerLeave={event => {
      event.currentTarget.style.removeProperty('--tilt-x');
      event.currentTarget.style.removeProperty('--tilt-y');
    }}>
      <Image src="/images/auth-sculpture.png" width={1199} height={1312} unoptimized priority
        alt="Orange and glass layers displaying a bar chart, trend line, and ring chart" />
    </div>
  );
}
