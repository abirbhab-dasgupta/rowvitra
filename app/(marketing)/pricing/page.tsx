import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { LandingNav } from '@/components/landing/landing-nav';

export const metadata: Metadata = { title: 'Pricing' };
export default function PricingPage() {
  return <div className="rv-landing pricing-page">
    <LandingNav />
    <main className="pricing-main">
      <div className="eyebrow">SIMPLE TO EXPLORE</div>
      <h1>Make sense of your data.<br /><em>No subscription required to explore.</em></h1>
      <p>Rowvitra is currently a hackathon prototype. You can explore the data-cleaning workflow on the landing page. Commercial plans have not been announced.</p>
      <div className="pricing-actions"><Link href="/#flow" className="button-dark">See how it works <ArrowRight size={16}/></Link><Link href="/sign-up" className="button-line">Create an account</Link></div>
      <section className="pricing-note"><CheckCircle2 size={23} color="#d84410" /><div><strong>What you can try</strong><p>Inspect a messy dataset, review repairs, create charts and export sample results. Saving your own datasets requires configured storage and an account.</p></div></section>
    </main>
  </div>;
}
