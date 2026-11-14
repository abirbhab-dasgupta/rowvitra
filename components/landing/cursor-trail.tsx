'use client';

import { useEffect } from 'react';

export function CursorTrail() {
  useEffect(() => {
    const preference = window.matchMedia('(any-hover: hover) and (any-pointer: fine) and (prefers-reduced-motion: no-preference)');
    const dots = Array.from({ length: 72 }, () => {
      const dot = document.createElement('i');
      dot.className = 'rv-cursor-particle';
      dot.setAttribute('aria-hidden', 'true');
      return dot;
    });
    let next = 0;
    let lastTime = 0;
    let lastX = -100;
    let lastY = -100;

    function clear() {
      for (const dot of dots) {
        dot.getAnimations().forEach(animation => animation.cancel());
        dot.remove();
      }
      lastX = lastY = -100;
    }

    function move(event: PointerEvent) {
      if (event.pointerType !== 'mouse' || !preference.matches) return;
      if (event.timeStamp - lastTime < 8 || Math.hypot(event.clientX - lastX, event.clientY - lastY) < 3) return;
      lastTime = event.timeStamp;
      lastX = event.clientX;
      lastY = event.clientY;
      const host = document.querySelector('dialog:modal') ?? document.body;
      for (let i = 0; i < 3; i++) {
        const dot = dots[next];
        next = (next + 1) % dots.length;
        if (dot.parentElement !== host) host.append(dot);
        const angle = (next * 2.4) + (i * Math.PI * 2 / 3);
        const radius = i === 0 ? 0 : 3 + i;
        dot.style.left = (lastX + Math.cos(angle) * radius) + 'px';
        dot.style.top = (lastY + Math.sin(angle) * radius) + 'px';
        dot.getAnimations().forEach(animation => animation.cancel());
        dot.animate([
          { opacity: 0.65, transform: 'translate(-50%, -50%) scale(1)' },
          { opacity: 0, transform: 'translate(-50%, 3px) scale(.35)' },
        ], { duration: 420, easing: 'ease-out' });
      }
    }

    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', clear);
    window.addEventListener('blur', clear);
    preference.addEventListener('change', clear);
    return () => {
      window.removeEventListener('pointermove', move);
      document.documentElement.removeEventListener('pointerleave', clear);
      window.removeEventListener('blur', clear);
      preference.removeEventListener('change', clear);
      clear();
    };
  }, []);
  return null;
}
