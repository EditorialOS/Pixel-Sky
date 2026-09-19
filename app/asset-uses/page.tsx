'use client';

/* Cloudinary delivery hosts are customer-configured, so these previews bypass Next image optimization. */
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';

type UseRequest = {
  id: string;
  public_id: string;
  filename: string;
  preview_url: string;
  usage_rights: string | null;
  credit: string | null;
  tags: string[];
  channel: string;
  campaign: string;
  placement: string;
  region: string;
  purpose: string;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  requested_by: string;
  created_at: string;
  expires_at: string | null;
};

type Candidate = {
  public_id: string;
  filename: string;
  preview_url: string;
  tags: string[];
  visual_description?: string;
};

const emptyForm = { channel: '', campaign: '', placement: '', region: '', purpose: '' };

export default function AssetUsesPage() {
  const [requests, setRequests] = useState<UseRequest[]>([]);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<{ requestId: string; imageUrl: string; downloadUrl: string } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/asset-uses', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load use requests.');
      setRequests(body.requests ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load use requests.');
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function search(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/dam/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, mode: 'semantic', limit: 24 }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Search failed.');
      setCandidates(body.assets ?? []);
      setSelected(null);
      if (!body.assets?.length) {
        setMessage(body.outside_scope_matches
          ? `${body.outside_scope_matches} matching assets are outside this workspace folder (${body.workspace_folder}).`
          : 'No matching assets found.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Search failed.');
    } finally { setLoading(false); }
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setBusyId('create');
    setMessage('');
    try {
      const response = await fetch('/api/asset-uses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_id: selected.public_id, ...form }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Request failed.');
      setMessage('Use request created. A workspace admin must approve it before delivery.');
      setSelected(null);
      setForm(emptyForm);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Request failed.');
    } finally { setBusyId(null); }
  }

  async function review(id: string, status: 'approved' | 'rejected' | 'revoked') {
    setBusyId(id);
    setMessage('');
    try {
      const response = await fetch(`/api/asset-uses/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Review failed.');
      setMessage(`Request ${status}.`);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Review failed.');
    } finally { setBusyId(null); }
  }

  async function getDelivery(id: string) {
    setBusyId(id);
    setMessage('');
    try {
      const response = await fetch(`/api/asset-uses/${id}/delivery`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Delivery failed.');
      setDelivery({ requestId: id, imageUrl: body.image_url, downloadUrl: body.download_url });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Delivery failed.');
    } finally { setBusyId(null); }
  }

  return <div className="min-h-screen bg-os-bg text-os-text">
    <header className="border-b border-black/10 bg-white/80">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-7">
        <div><p className="text-[11px] uppercase tracking-[0.3em] text-os-muted">PixelSky / Review</p><h1 className="text-4xl font-semibold tracking-tight">Use approvals</h1><p className="mt-1 text-sm text-os-muted">Approve a specific image for a specific job before delivery.</p></div>
        <div className="flex flex-wrap items-center gap-3 text-xs"><Link href="/" className="rounded-full border border-black/10 bg-white px-3 py-2">Library</Link><Link href="/asset-packs" className="rounded-full border border-black/10 bg-white px-3 py-2">Asset packs</Link><OrganizationSwitcher hidePersonal /><UserButton /></div>
      </div>
    </header>
    <main className="mx-auto grid max-w-6xl gap-8 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(360px,1fr)]">
      <section className="rounded-3xl border border-black/10 bg-white p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-os-muted">Request</p><h2 className="mt-2 text-2xl font-semibold">Find a candidate</h2>
        <form onSubmit={search} className="mt-5 flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try: warm coastal travel at sunset" className="min-w-0 flex-1 rounded-xl border border-black/15 px-3 py-2 text-sm" /><button disabled={loading} className="rounded-xl bg-os-accent px-4 py-2 text-sm font-semibold text-white">Search</button></form>
        <div className="mt-4 grid max-h-72 grid-cols-2 gap-3 overflow-auto sm:grid-cols-3">
          {candidates.map((candidate) => <button key={candidate.public_id} type="button" title={candidate.visual_description} onClick={() => setSelected(candidate)} className={`overflow-hidden rounded-xl border text-left ${selected?.public_id === candidate.public_id ? 'border-os-accent' : 'border-black/10'}`}><img src={candidate.preview_url} alt={candidate.visual_description || candidate.filename} className="aspect-square w-full object-cover" /><span className="block truncate p-2 text-xs">{candidate.filename}</span></button>)}
        </div>
        {selected && <form onSubmit={create} className="mt-6 grid gap-3"><h3 className="font-semibold">Request use of {selected.filename}</h3>{(Object.keys(form) as (keyof typeof form)[]).map((field) => <label key={field} className="grid gap-1 text-xs font-medium capitalize">{field}<input required maxLength={field === 'purpose' ? 1000 : 140} value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} placeholder={field === 'region' ? 'US, EU, or global' : undefined} className="rounded-xl border border-black/15 px-3 py-2 text-sm font-normal" /></label>)}<button disabled={busyId === 'create'} className="mt-2 rounded-xl bg-os-accent px-4 py-3 text-sm font-semibold text-white">Send for approval</button></form>}
      </section>
      <section className="rounded-3xl border border-black/10 bg-white p-6">
        <div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.2em] text-os-muted">Workspace</p><h2 className="mt-2 text-2xl font-semibold">Review queue</h2></div><button onClick={() => void refresh()} className="text-sm font-semibold text-os-accent">Refresh</button></div>
        {message && <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">{message}</p>}
        <div className="mt-5 space-y-4">{requests.length === 0 && <p className="text-sm text-os-muted">No use requests yet.</p>}{requests.map((item) => <article key={item.id} className="rounded-2xl border border-black/10 p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><img src={item.preview_url} alt={item.filename} className="h-20 w-20 shrink-0 rounded-xl object-cover" /><div className="min-w-0"><p className="font-semibold break-all">{item.filename}</p><p className="mt-1 text-xs text-os-muted break-all">{item.public_id}</p><p className="mt-1 text-xs text-os-muted">{item.channel} / {item.campaign} / {item.region}</p></div></div><span className="rounded-full border border-black/10 px-2 py-1 text-xs capitalize">{item.status}</span></div><p className="mt-3 text-sm">{item.purpose}</p><p className="mt-1 text-xs text-os-muted">Placement: {item.placement}</p><p className="mt-1 text-xs text-os-muted">Rights: {item.usage_rights || 'Not recorded in Cloudinary'}{item.credit ? ` · Credit: ${item.credit}` : ''}</p>{item.tags.length > 0 && <p className="mt-1 text-xs text-os-muted">Tags: {item.tags.join(', ')}</p>}{item.expires_at && <p className="mt-1 text-xs text-os-muted">Approval expires {new Date(item.expires_at).toLocaleDateString()}</p>}<div className="mt-4 flex flex-wrap gap-2">{item.status === 'pending' && <><button disabled={busyId === item.id} onClick={() => void review(item.id, 'approved')} className="rounded-lg bg-os-accent px-3 py-2 text-xs font-semibold text-white">Approve for 30 days</button><button disabled={busyId === item.id} onClick={() => void review(item.id, 'rejected')} className="rounded-lg border border-black/15 px-3 py-2 text-xs">Reject</button></>}{item.status === 'approved' && <><button disabled={busyId === item.id} onClick={() => void getDelivery(item.id)} className="rounded-lg bg-os-accent px-3 py-2 text-xs font-semibold text-white">Get delivery</button><button disabled={busyId === item.id} onClick={() => void review(item.id, 'revoked')} className="rounded-lg border border-black/15 px-3 py-2 text-xs">Revoke</button></>}</div>{delivery?.requestId === item.id && <div className="mt-3 flex gap-4 text-xs"><a href={delivery.imageUrl} target="_blank" rel="noreferrer" className="font-semibold text-os-accent underline">Open image</a><a href={delivery.downloadUrl} className="font-semibold text-os-accent underline">Download</a></div>}</article>)}</div>
      </section>
    </main>
  </div>;
}
