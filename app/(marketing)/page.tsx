import { CursorTrail } from '@/components/landing/cursor-trail';
import { DuplicatePreview } from '@/components/landing/duplicate-preview';
import Image from 'next/image';
import { LandingFlow } from '@/components/landing/landing-flow';
import './landing.css';
import Link from 'next/link';
import { ArrowRight, ArrowDown, Download } from 'lucide-react';
import { LandingNav } from '@/components/landing/landing-nav';
import { LandingMotion } from '@/components/landing/landing-motion';

export default function HomePage() {
  return (
    <div className="rv-landing rv-home" id="top">
      <LandingMotion />
      <CursorTrail />
      <LandingNav />
      <main>
        <section className="land-hero" aria-labelledby="hero-title">
          <div className="land-hero-copy">
            <h1 id="hero-title" className="motion-headline">
              <span>Your data is messy.</span>
              <span>Your insights <em>shouldn’t be.</em></span>
            </h1>
            <p className="motion-fade motion-delay-1">
              Clean, explore, and visualize your data in one workspace. Review every change along the way.
            </p>
            <div className="land-actions motion-fade motion-delay-2">
              <Link className="button-dark" href="/sign-up">Start Exploring <ArrowRight size={17} aria-hidden="true" /></Link>
              <a className="play-link" href="#flow">See how it works <ArrowDown size={15} aria-hidden="true" /></a>
            </div>
          </div>
        </section>
        <section className="land-flow" id="flow" aria-labelledby="flow-title">
          <div className="flow-exhibit">
            <div className="hero-scene">
              <Image
                className="land-art"
                src="/images/landing-hero-art.webp"
                alt="Sculptural concrete arch, fragments transforming into elegant data charts"
                fill
                priority
                sizes="(max-width: 760px) 153vw, 100vw"
              />
              {[0, 2].map(index => <span aria-hidden="true" key={index} className={`stone stone-${index}`} />)}
              <span className="orbit-stone" aria-hidden="true">
                <span className="mineral-cube">
                  {['front', 'back', 'left', 'right', 'top', 'bottom'].map(face => (
                    <i key={face} className={`cube-face cube-${face}`} />
                  ))}
                </span>
              </span>
            </div>
            <div className="flow-heading">
              <h2 id="flow-title">From chaos <br />to <em>clarity.</em></h2>
              <p>Follow three sales records from a messy spreadsheet to a number you can explain.</p>
            </div>
          </div>
          <LandingFlow />
        </section>
        <DuplicatePreview />
        <section className="land-control" id="product" aria-labelledby="control-title">

          <div className="control-copy" data-reveal>
            <div>
              <h2 id="control-title">Understand,<br />edit, and <em>refine</em><br />your data.</h2>
            </div>
            <div className="control-vline" aria-hidden="true" />
            <div className="control-description">
              <p>Inspect flagged cells, compare suggested repairs, and choose which changes to keep.</p>
              <a className="button-dark" href="#repair-heading">Compare a repair <ArrowRight size={17} aria-hidden="true" /></a>
            </div>
          </div>
          <Image src="/images/landing-control.webp" fill alt="Concrete architecture with flowing orange sculptural ribbon" className="architecture-art" sizes="100vw" />
        </section>
        <section id="exports" className="export-story" aria-labelledby="export-heading">
          <div className="story-intro">
            <h2 id="export-heading">Take your<br /><em>work with you.</em></h2>
            <p>When the review is finished, export the cleaned file, the steps that produced it, or a record of what changed.</p>
            <a href="/examples/messy-sales.csv" download className="button-dark">Download sample CSV <Download size={17} aria-hidden="true" /></a>
          </div>
          <div className="export-list">
            <details open><summary>Cleaned CSV</summary><p>Open the reviewed rows in your spreadsheet or analysis tool. The CSV contains the values from your selected version.</p></details>
            <details><summary>Python script</summary><p>Run the accepted cleaning steps against the original CSV with pandas. You can inspect each transformation in the script.</p></details>
            <details><summary>Audit report</summary><p>Trace a change back to its version, operation, and timestamp. Share the report alongside the cleaned file so a teammate can review how it was prepared.</p></details>
          </div>
        </section>
      </main>
      <footer className="land-footer" id="features">
        <Link href="/" className="rv-brand" aria-label="Rowvitra home"><span className="rv-brand-mark" aria-hidden="true"><i /><i /></span>Rowvitra</Link>
        <span className="footer-motto">From Raw Data to<br />Reliable Insights.</span>
        <nav aria-label="Footer"><a href="#product">Product</a><a href="#flow">Features</a><a href="#exports">Exports</a><Link href="/pricing">Pricing</Link></nav>
      </footer>
    </div>
  );
}
