'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function MarketingPage() {
  const [email, setEmail] = useState('');
  const [submitState, setSubmitState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) return;

    setSubmitState('loading');
    setSubmitMessage('');

    try {
      const response = await fetch('/api/marketing/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setSubmitState('error');
        setSubmitMessage(data.error || 'Unable to join waitlist right now.');
        return;
      }

      setSubmitState('success');
      setSubmitMessage('Thanks. We will reach out when early access opens.');
      setEmail('');
    } catch (error) {
      console.error('Waitlist submit failed:', error);
      setSubmitState('error');
      setSubmitMessage('Unable to join waitlist right now.');
    }
  };

  return (
    <div className="min-h-screen bg-os-bg text-os-text">
      <header className="border-b border-black/5 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-wide">PixelSky</span>
            <span className="rounded-full border border-black/10 bg-os-bg px-2 py-0.5 text-[10px] text-os-muted">
              Beta
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link
              href="/sign-in"
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-os-text shadow-sm transition hover:bg-os-bg"
            >
              Open app
            </Link>
            <a
              href="#waitlist"
              className="rounded-full bg-os-accent px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-blue-600"
            >
              Join waitlist
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="gradient-bg">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div className="space-y-6">
                <p className="text-xs uppercase tracking-[0.3em] text-os-muted">PixelSky</p>
                <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                  An AI-native DAM for small teams
                </h1>
                <p className="text-base text-os-muted">
                  PixelSky is a Light DAM. Ask the DAM, generate campaign-ready crops, and keep metadata clean.
                  Built for marketing teams, agencies, solopreneurs, and small tourism boards.
                </p>
                <div className="flex flex-wrap gap-3">
                  <a
                    href="#waitlist"
                    className="rounded-full bg-os-accent px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
                  >
                    Join the waitlist
                  </a>
                  <Link
                    href="/sign-in"
                    className="rounded-full border border-black/10 bg-white px-5 py-2 text-sm text-os-text shadow-sm transition hover:bg-os-bg"
                  >
                    Try the demo
                  </Link>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-os-muted">
                  {[
                    'Ask the DAM in natural language',
                    'AI auto-tagging + metadata',
                    'Campaign-ready variants',
                    'Search by campaign or rights',
                  ].map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-black/10 bg-white px-3 py-1 shadow-sm"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
                <p className="text-xs uppercase tracking-[0.3em] text-os-muted">Why teams choose it</p>
                <div className="mt-4 space-y-4 text-sm text-os-muted">
                  <div className="rounded-2xl border border-black/10 bg-os-bg p-4">
                    <p className="text-sm font-semibold text-os-text">Ask the DAM</p>
                    <p>Search with intent: “cozy winter lifestyle shots”.</p>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-os-bg p-4">
                    <p className="text-sm font-semibold text-os-text">Campaign-ready variants</p>
                    <p>Generate Instagram, Pinterest, and banner crops instantly.</p>
                  </div>
                  <div className="rounded-2xl border border-black/10 bg-os-bg p-4">
                    <p className="text-sm font-semibold text-os-text">Bring your own Cloudinary</p>
                    <p>Your assets stay in your account. We handle the AI layer.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-6 md:grid-cols-3">
            {[
              {
                title: 'Ask the DAM',
                copy: 'Natural language search finds assets even when tags are messy.',
              },
              {
                title: 'Campaign-ready crops',
                copy: 'AI smart-crop outputs Instagram, Pinterest, and banner sizes.',
              },
              {
                title: 'Metadata that stays clean',
                copy: 'Photographer, usage rights, and campaign info stay attached.',
              },
            ].map((feature) => (
              <div key={feature.title} className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
                <h3 className="text-base font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-os-muted">{feature.copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-16">
          <div className="rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-os-muted">Pricing</p>
                <h2 className="text-3xl font-semibold">Simple and predictable</h2>
                <p className="mt-2 text-sm text-os-muted">
                  One plan for small teams. You keep your Cloudinary storage.
                </p>
              </div>
              <div className="rounded-2xl border border-black/10 bg-os-bg px-6 py-5 text-center">
                <p className="text-3xl font-semibold">$29</p>
                <p className="text-xs uppercase tracking-[0.2em] text-os-muted">Per month</p>
                <p className="mt-2 text-xs text-os-muted">For up to 50 assets</p>
              </div>
            </div>
          </div>
        </section>

        <section id="waitlist" className="mx-auto max-w-6xl px-6 pb-20">
          <div className="rounded-3xl border border-black/10 bg-white p-8 shadow-sm">
            <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr] md:items-center">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-os-muted">Waitlist</p>
                <h2 className="text-3xl font-semibold">Join early access</h2>
                <p className="mt-2 text-sm text-os-muted">
                  Be first in line when PixelSky opens to new teams.
                </p>
              </div>
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                  required
                  className="h-12 rounded-xl border border-black/10 bg-white px-4 text-sm text-os-text shadow-sm focus:border-os-accent focus:outline-none focus:ring-2 focus:ring-os-accent/20"
                />
                <button
                  type="submit"
                  disabled={submitState === 'loading'}
                  className="h-12 rounded-xl bg-os-accent text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
                >
                  {submitState === 'loading' ? 'Joining...' : 'Join waitlist'}
                </button>
                {submitState !== 'idle' && (
                  <p className={submitState === 'error' ? 'text-xs text-red-600' : 'text-xs text-os-muted'}>
                    {submitMessage}
                  </p>
                )}
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-black/5 bg-white/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-6 text-xs text-os-muted sm:flex-row sm:items-center sm:justify-between">
          <span>PixelSky — Light DAM for small teams</span>
          <div className="flex items-center gap-3">
            <Link href="/legal/privacy" className="underline">
              Privacy
            </Link>
            <Link href="/legal/terms" className="underline">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
