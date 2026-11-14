import Image from 'next/image';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight, Play } from 'lucide-react';
import { LandingNav } from '@/components/landing/landing-nav';
import { LandingMotion } from '@/components/landing/landing-motion';

const steps = [
  { image: 'flow-messy', label: 'Messy Data' },
  { image: 'flow-clean', label: 'AI Cleaning' },
  { image: 'flow-visual', label: 'Visualize' },
  { image: 'flow-insights', label: 'Reliable Insights' },
];

export default function HomePage() {
  return (
    <div className="rv-landing" id="top">
      <LandingMotion />
      <LandingNav />
      <main>
        <section className="land-hero" aria-labelledby="hero-title">
          <div className="land-hero-shade" aria-hidden="true" />
          <Image
            className="land-art"
            src="/images/hero-art.webp"
            alt="Sculptural concrete arch, fragments transforming into elegant data charts"
            fill
            priority
            sizes="(max-width: 760px) 100vw, 62vw"
          />
          <div className="land-hero-copy">
            <div className="eyebrow motion-fade">AI DATA WORKSPACE</div>
            <h1 id="hero-title" className="motion-headline">
              <span>Your data is messy.</span>
              <span>Your insights</span>
              <span><em>shouldn’t be.</em></span>
            </h1>
            <p className="motion-fade motion-delay-1">
              Meet Rowvitra, the AI powered workspace that cleans, transforms, and visualizes your data.
            </p>
            <div className="land-actions motion-fade motion-delay-2">
              <Link className="button-dark" href="/sign-up">Start Exploring <ArrowRight size={17} aria-hidden="true" /></Link>
              <Link className="play-link" href="/demo"><span className="play-ring"><Play size={12} fill="currentColor" aria-hidden="true" /></span>See How It Works</Link>
            </div>
          </div>
        </section>
        <section className="land-flow" id="flow" aria-labelledby="flow-title">
          <div className="flow-heading" data-reveal>
            <div className="eyebrow">THE FLOW</div>
            <h2 id="flow-title">From<br />chaos to<br /><em>clarity.</em></h2>
          </div>
          <div className="flow-divider" aria-hidden="true" />
          <div className="flow-icons">
            {steps.map(({ image, label }, index) => (
              <div className="flow-icon" data-reveal key={label} style={{ '--reveal-delay': `${index * 95}ms` } as CSSProperties}>
                <Image src={`/images/${image}.webp`} alt="" width={150} height={150} sizes="(max-width: 760px) 40vw, 150px" />
                <strong>{label}</strong>
                {index < steps.length - 1 && <span className="flow-arrow" aria-hidden="true">→</span>}
              </div>
            ))}
          </div>
        </section>
        <section className="land-control" id="product" aria-labelledby="control-title">
          <div className="control-accent" aria-hidden="true" />
          <div className="control-copy" data-reveal>
            <div>
              <div className="eyebrow">BUILT FOR CONTROL</div>
              <h2 id="control-title">Understand,<br />edit, and <em>refine</em><br />your data.</h2>
            </div>
            <div className="control-vline" aria-hidden="true" />
            <div className="control-description">
              <p>Inspect issues, review AI suggestions, make changes, and take full control of every transformation.</p>
              <Link className="button-dark" href="/demo">Explore Features <ArrowRight size={17} aria-hidden="true" /></Link>
            </div>
          </div>
          <Image src="/images/architecture-base.webp" fill alt="Concrete architecture with flowing orange sculptural ribbon" className="architecture-art" sizes="100vw" />
        </section>
      </main>
      <footer className="land-footer" id="features">
        <Link href="/" className="rv-brand" aria-label="Rowvitra home"><span className="rv-brand-mark" aria-hidden="true"><i /><i /></span>Rowvitra</Link>
        <span className="footer-motto">From Raw Data to<br />Reliable Insights.</span>
        <nav aria-label="Footer"><a href="#product">Product</a><a href="#flow">Features</a><Link href="/demo">Resources</Link><Link href="/pricing">Pricing</Link></nav>
      </footer>
    </div>
  );
}
