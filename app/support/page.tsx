'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function SupportPage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  async function requestSupport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState('loading');
    try {
      const response = await fetch('/api/marketing/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'support' }),
      });
      setState(response.ok ? 'success' : 'error');
      if (response.ok) setEmail('');
    } catch {
      setState('error');
    }
  }

  return (
    <main className="min-h-screen bg-os-bg px-6 py-10 text-os-text">
      <div className="mx-auto max-w-3xl rounded-3xl border border-black/10 bg-white p-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-os-accent">PixelSky</p>
            <h1 className="mt-2 text-3xl font-semibold">Support</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-os-muted">
              Get help with your workspace, Cloudinary connection, ChatGPT plugin, Figma plugin,
              billing, data export, or account deletion.
            </p>
          </div>
          <Link href="/marketing" className="text-sm underline">Back</Link>
        </div>

        <section className="mt-8 rounded-2xl border border-black/10 bg-os-surface p-5">
          <h2 className="font-semibold">Request a support reply</h2>
          <p className="mt-2 text-sm leading-6 text-os-muted">
            Enter the email attached to your PixelSky account. Support will follow up using that address.
          </p>
          <form onSubmit={requestSupport} className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              className="h-11 flex-1 rounded-xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-os-accent focus:ring-2 focus:ring-os-accent/20"
            />
            <button
              type="submit"
              disabled={state === 'loading'}
              className="h-11 rounded-xl bg-os-accent px-5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {state === 'loading' ? 'Sending...' : 'Request support'}
            </button>
          </form>
          {state === 'success' && <p className="mt-3 text-sm text-emerald-700">Your support request was received.</p>}
          {state === 'error' && <p className="mt-3 text-sm text-red-700">The request could not be sent. Try again shortly.</p>}
        </section>

        <section className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <div className="rounded-2xl border border-black/10 p-5">
            <h2 className="font-semibold">ChatGPT connection</h2>
            <p className="mt-2 leading-6 text-os-muted">
              Disconnect and reconnect PixelSky from ChatGPT if authorization expires or the wrong workspace is selected.
            </p>
          </div>
          <div className="rounded-2xl border border-black/10 p-5">
            <h2 className="font-semibold">Approvals and delivery</h2>
            <p className="mt-2 leading-6 text-os-muted">
              Agents may request an image use, but only a workspace member can approve it before delivery.
            </p>
          </div>
        </section>

        <div className="mt-8 flex gap-4 text-sm">
          <Link href="/legal/privacy" className="underline">Privacy</Link>
          <Link href="/legal/terms" className="underline">Terms</Link>
        </div>
      </div>
    </main>
  );
}
