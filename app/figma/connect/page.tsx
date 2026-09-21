'use client';

import { FormEvent, useEffect, useState } from 'react';
import { OrganizationSwitcher, useOrganization } from '@clerk/nextjs';

export default function FigmaConnectPage() {
  const { organization } = useOrganization();
  const [state, setState] = useState<'idle' | 'loading' | 'complete'>('idle');
  const [message, setMessage] = useState('');
  const [pair, setPair] = useState('');
  useEffect(() => { setPair(new URLSearchParams(window.location.search).get('pair') ?? ''); }, []);

  async function approve(event: FormEvent) {
    event.preventDefault();
    setState('loading');
    setMessage('');
    try {
      const response = await fetch('/api/figma/pair/approve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: pair }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Connection failed.');
      setState('complete');
      setMessage('PixelSky is connected. Return to Figma.');
    } catch (error) {
      setState('idle');
      setMessage(error instanceof Error ? error.message : 'Connection failed.');
    }
  }

  return <main className="min-h-screen bg-os-bg px-6 py-20 text-os-text"><div className="mx-auto max-w-lg rounded-3xl border border-black/10 bg-white p-8"><p className="text-xs uppercase tracking-[0.25em] text-os-muted">PixelSky / Figma</p><h1 className="mt-3 text-3xl font-semibold">Connect your workspace</h1><p className="mt-3 text-sm text-os-muted">This lets the Figma plugin search your Cloudinary library, request image use, and place images only after approval. It cannot approve its own requests.</p><div className="mt-6 rounded-2xl border border-black/10 p-4"><p className="text-xs text-os-muted">Connecting workspace</p><p className="mt-1 font-semibold">{organization?.name ?? 'Choose a workspace'}</p><div className="mt-3"><OrganizationSwitcher hidePersonal /></div></div>{!pair && <p className="mt-5 text-sm text-red-700">Missing pairing code. Start again in Figma.</p>}{message && <p role="status" className="mt-5 text-sm">{message}</p>}{pair && state !== 'complete' && <form onSubmit={approve}><button disabled={!organization || state === 'loading'} className="mt-6 w-full rounded-xl bg-os-accent px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Connect PixelSky to Figma</button></form>}<p className="mt-5 text-xs text-os-muted">The plugin token expires after 30 days and can be revoked in Agent access.</p></div></main>;
}
