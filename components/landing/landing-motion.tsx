'use client';
import { useEffect } from 'react';

/** Progressive enhancement: the content is visible if JavaScript or motion is unavailable. */
export function LandingMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.rv-landing');
    if (!root || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const nodes = root.querySelectorAll<HTMLElement>('[data-reveal]');
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.1, rootMargin: '0px 0px -24px 0px' });
    nodes.forEach(node => observer.observe(node));
    root.classList.add('motion-enhanced');
    return () => { observer.disconnect(); root.classList.remove('motion-enhanced'); };
  }, []);
  return null;
}
