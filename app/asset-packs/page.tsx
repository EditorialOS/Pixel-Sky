'use client';

/* Cloudinary delivery hosts are customer-configured, so these previews bypass Next image optimization. */
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { OrganizationSwitcher, UserButton } from '@clerk/nextjs';
import Link from 'next/link';

type DamAsset = {
  id: string;
  public_id: string;
  filename: string;
  tags: string[];
  preview_url: string;
  context: Record<string, string>;
  metadata: Record<string, string>;
};

type AssetPackVariant = {
  id: string;
  label: string;
  width: number;
  height: number;
  delivery_url: string;
};

type AssetPackAsset = {
  public_id: string;
  filename: string;
  preview_url: string;
  source_url: string;
  tags: string[];
  campaign: string | null;
  usage_rights: string | null;
  description: string | null;
  rationale: string | null;
  variants: AssetPackVariant[];
};

type AssetPack = {
  id: string;
  title: string;
  brief: string;
  channels: string[];
  notes: string | null;
  status: 'draft' | 'approved' | 'rejected';
  assets: AssetPackAsset[];
  created_at: string;
  reviewed_at: string | null;
};

type SearchResponse = {
  assets?: DamAsset[];
  error?: string;
};

type PacksResponse = {
  packs?: AssetPack[];
  error?: string;
};

const CHANNELS = ['Email', 'Instagram', 'LinkedIn', 'Website'];

function selectedVariants(channels: string[]) {
  const variants = new Set<string>();
  if (channels.some((channel) => channel === 'Instagram' || channel === 'LinkedIn')) {
    variants.add('instagram_square');
    variants.add('instagram_portrait');
  }
  if (channels.includes('Email') || channels.includes('Website')) {
    variants.add('banner');
  }
  return Array.from(variants);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unknown date'
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusClass(status: AssetPack['status']) {
  if (status === 'approved') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'rejected') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

export default function AssetPacksPage() {
  const [packs, setPacks] = useState<AssetPack[]>([]);
  const [activePack, setActivePack] = useState<AssetPack | null>(null);
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [channels, setChannels] = useState<string[]>(['Instagram', 'Email']);
  const [notes, setNotes] = useState('');
  const [candidateRationale, setCandidateRationale] = useState('');
  const [assets, setAssets] = useState<DamAsset[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'error'>('loading');
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [createStatus, setCreateStatus] = useState<'idle' | 'creating' | 'error'>('idle');
  const [reviewStatus, setReviewStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const loadPacks = useCallback(async () => {
    setLoadStatus('loading');
    try {
      const response = await fetch('/api/asset-packs?limit=50');
      const data = (await response.json()) as PacksResponse;
      if (!response.ok) {
        setMessage(data.error || 'Unable to load asset packs.');
        setLoadStatus('error');
        return;
      }
      const nextPacks = data.packs ?? [];
      setPacks(nextPacks);
      setActivePack((current) => current
        ? nextPacks.find((pack) => pack.id === current.id) ?? null
        : nextPacks[0] ?? null);
      setLoadStatus('idle');
    } catch (error) {
      console.error('Asset pack load failed:', error);
      setMessage('Unable to reach the asset-pack service.');
      setLoadStatus('error');
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadPacks();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [loadPacks]);

  const toggleChannel = useCallback((channel: string) => {
    setChannels((current) => current.includes(channel)
      ? current.filter((item) => item !== channel)
      : [...current, channel]);
  }, []);

  const toggleAsset = useCallback((publicId: string) => {
    setSelectedAssetIds((current) => {
      const next = new Set(current);
      if (next.has(publicId)) next.delete(publicId);
      else next.add(publicId);
      return next;
    });
  }, []);

  const searchLibrary = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    if (!brief.trim()) {
      setMessage('Describe the brief before searching the library.');
      return;
    }
    setSearchStatus('loading');
    setMessage('');
    try {
      const response = await fetch('/api/dam/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: brief.trim(), mode: 'semantic', limit: 24 }),
      });
      const data = (await response.json()) as SearchResponse;
      if (!response.ok) {
        setMessage(data.error || 'Unable to search the library.');
        setSearchStatus('error');
        return;
      }
      setAssets(data.assets ?? []);
      setSelectedAssetIds(new Set());
      setSearchStatus('idle');
      setMessage(data.assets?.length ? 'Choose the assets to include in this draft.' : 'No matching assets found. Try a simpler brief.');
    } catch (error) {
      console.error('Asset pack search failed:', error);
      setMessage('Unable to reach the asset search service.');
      setSearchStatus('error');
    }
  }, [brief]);

  const createPack = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    const selectedAssets = assets.filter((asset) => selectedAssetIds.has(asset.public_id));
    if (!brief.trim() || selectedAssets.length === 0) {
      setMessage('Add a brief and select at least one asset.');
      setCreateStatus('error');
      return;
    }
    setCreateStatus('creating');
    setMessage('');
    try {
      const response = await fetch('/api/asset-packs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          brief,
          channels,
          notes,
          assets: selectedAssets.map((asset) => ({
            public_id: asset.public_id,
            rationale: candidateRationale || `Candidate selected for: ${brief.trim()}`,
            variants: selectedVariants(channels),
          })),
        }),
      });
      const data = (await response.json()) as { pack?: AssetPack; error?: string };
      if (!response.ok || !data.pack) {
        setCreateStatus('error');
        setMessage(data.error || 'Unable to create the asset pack.');
        return;
      }
      setPacks((current) => [data.pack as AssetPack, ...current]);
      setActivePack(data.pack as AssetPack);
      setTitle('');
      setBrief('');
      setChannels(['Instagram', 'Email']);
      setNotes('');
      setCandidateRationale('');
      setAssets([]);
      setSelectedAssetIds(new Set());
      setCreateStatus('idle');
      setMessage('Draft asset pack created. It is ready for human review.');
    } catch (error) {
      console.error('Asset pack creation failed:', error);
      setCreateStatus('error');
      setMessage('Unable to reach the asset-pack service.');
    }
  }, [assets, brief, candidateRationale, channels, notes, selectedAssetIds, title]);

  const reviewPack = useCallback(async (status: 'approved' | 'rejected') => {
    if (!activePack || activePack.status !== 'draft') return;
    setReviewStatus('saving');
    setMessage('');
    try {
      const response = await fetch(`/api/asset-packs/${activePack.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = (await response.json()) as { pack?: AssetPack; error?: string };
      if (!response.ok || !data.pack) {
        setReviewStatus('error');
        setMessage(data.error || 'Unable to review this asset pack.');
        return;
      }
      const updated = data.pack as AssetPack;
      setActivePack(updated);
      setPacks((current) => current.map((pack) => pack.id === updated.id ? updated : pack));
      setReviewStatus('idle');
      setMessage(status === 'approved' ? 'Asset pack approved and ready for an agent to use.' : 'Asset pack rejected.');
    } catch (error) {
      console.error('Asset pack review failed:', error);
      setReviewStatus('error');
      setMessage('Unable to reach the asset-pack service.');
    }
  }, [activePack]);

  const selectedCount = selectedAssetIds.size;
  const proposedVariants = useMemo(() => selectedVariants(channels), [channels]);

  return (
    <div className="min-h-screen bg-os-bg text-os-text">
      <header className="border-b border-black/5 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-7 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-os-muted">PixelSky / Agent workflow</p>
            <h1 className="text-4xl font-semibold tracking-tight">Asset packs</h1>
            <p className="mt-1 text-sm text-os-muted">Turn a brief into a reviewable, agent-ready set of assets.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <Link href="/" className="rounded-full border border-black/10 bg-white px-3 py-2 text-os-text transition hover:bg-os-bg">Asset library</Link>
            <a href="/audit" className="rounded-full border border-black/10 bg-white px-3 py-2 text-os-text transition hover:bg-os-bg">Activity log</a>
            <OrganizationSwitcher hidePersonal appearance={{ elements: { organizationSwitcherTrigger: 'rounded-full border border-black/10 bg-white px-3 py-2 text-xs' } }} />
            <UserButton appearance={{ elements: { userButtonAvatarBox: 'h-8 w-8' } }} />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-8">
          <section className="rounded-3xl border border-black/10 bg-white p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-os-muted">1. Create a draft</p>
                <h2 className="mt-1 text-xl font-semibold">Search from the brief</h2>
              </div>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-800">Human approval required</span>
            </div>

            <form className="mt-6 grid gap-4" onSubmit={searchLibrary}>
              <label className="grid gap-2 text-sm font-medium text-os-text">
                Brief
                <textarea value={brief} onChange={(event) => setBrief(event.target.value)} required rows={4} placeholder="Example: Three approved autumn lifestyle images for an Instagram and email launch." className="rounded-2xl border border-black/10 bg-os-bg px-4 py-3 text-sm font-normal text-os-text placeholder:text-os-muted focus:border-os-accent focus:outline-none focus:ring-2 focus:ring-os-accent/20" />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-os-text">
                  Pack title <span className="font-normal text-os-muted">optional</span>
                  <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Autumn launch candidates" className="h-11 rounded-xl border border-black/10 bg-os-bg px-3 text-sm font-normal text-os-text placeholder:text-os-muted focus:border-os-accent focus:outline-none focus:ring-2 focus:ring-os-accent/20" />
                </label>
                <div className="grid gap-2 text-sm font-medium text-os-text">
                  Intended channels
                  <div className="flex flex-wrap gap-2">
                    {CHANNELS.map((channel) => (
                      <button key={channel} type="button" onClick={() => toggleChannel(channel)} className={`rounded-full border px-3 py-2 text-xs font-medium transition ${channels.includes(channel) ? 'border-os-accent bg-blue-50 text-os-accent' : 'border-black/10 bg-os-bg text-os-muted hover:text-os-text'}`}>
                        {channel}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button type="submit" disabled={searchStatus === 'loading'} className="h-11 w-fit rounded-xl bg-os-accent px-5 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60">
                {searchStatus === 'loading' ? 'Searching library...' : 'Find candidate assets'}
              </button>
            </form>
          </section>

          {assets.length > 0 && (
            <section className="rounded-3xl border border-black/10 bg-white p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-os-muted">2. Select candidates</p>
                  <h2 className="mt-1 text-xl font-semibold">{selectedCount} asset{selectedCount === 1 ? '' : 's'} selected</h2>
                </div>
                {proposedVariants.length > 0 && <p className="text-xs text-os-muted">Variant delivery URLs: {proposedVariants.join(', ').replaceAll('_', ' ')}</p>}
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {assets.map((asset) => {
                  const selected = selectedAssetIds.has(asset.public_id);
                  return (
                    <button key={asset.public_id} type="button" onClick={() => toggleAsset(asset.public_id)} className={`overflow-hidden rounded-2xl border text-left transition ${selected ? 'border-os-accent ring-2 ring-os-accent/20' : 'border-black/10 hover:border-black/25'}`}>
                      <img src={asset.preview_url} alt={asset.filename} className="aspect-square w-full object-cover" />
                      <span className="block p-3">
                        <span className="block truncate text-sm font-semibold text-os-text">{asset.filename}</span>
                        <span className="mt-1 block line-clamp-2 text-xs text-os-muted">{asset.tags.length ? asset.tags.join(', ') : asset.metadata.description || asset.context.description || 'No asset tags'}</span>
                        <span className={`mt-3 inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${selected ? 'bg-blue-50 text-os-accent' : 'bg-os-bg text-os-muted'}`}>{selected ? 'Included' : 'Select'}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <form className="mt-6 grid gap-4 border-t border-black/10 pt-6" onSubmit={createPack}>
                <label className="grid gap-2 text-sm font-medium text-os-text">
                  Selection rationale <span className="font-normal text-os-muted">optional</span>
                  <input value={candidateRationale} onChange={(event) => setCandidateRationale(event.target.value)} placeholder="Example: Matches the campaign mood and has approved paid-social usage rights." className="h-11 rounded-xl border border-black/10 bg-os-bg px-3 text-sm font-normal text-os-text placeholder:text-os-muted focus:border-os-accent focus:outline-none focus:ring-2 focus:ring-os-accent/20" />
                </label>
                <label className="grid gap-2 text-sm font-medium text-os-text">
                  Review note <span className="font-normal text-os-muted">optional</span>
                  <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="What should the reviewer check before approval?" className="rounded-xl border border-black/10 bg-os-bg px-3 py-2 text-sm font-normal text-os-text placeholder:text-os-muted focus:border-os-accent focus:outline-none focus:ring-2 focus:ring-os-accent/20" />
                </label>
                <button type="submit" disabled={createStatus === 'creating' || selectedCount === 0} className="h-11 w-fit rounded-xl bg-os-accent px-5 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60">
                  {createStatus === 'creating' ? 'Creating draft...' : 'Create draft asset pack'}
                </button>
              </form>
            </section>
          )}

          {message && <p className={`rounded-2xl border px-4 py-3 text-sm ${createStatus === 'error' || searchStatus === 'error' || reviewStatus === 'error' || loadStatus === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-black/10 bg-white text-os-muted'}`}>{message}</p>}
        </div>

        <aside className="space-y-5">
          <section className="rounded-3xl border border-black/10 bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-os-muted">Saved packs</p>
                <h2 className="mt-1 text-lg font-semibold">Review queue</h2>
              </div>
              <button type="button" onClick={() => void loadPacks()} className="text-xs font-medium text-os-accent hover:underline">Refresh</button>
            </div>
            <div className="mt-4 grid gap-2">
              {loadStatus === 'loading' && <p className="text-sm text-os-muted">Loading asset packs...</p>}
              {loadStatus !== 'loading' && packs.length === 0 && <p className="text-sm text-os-muted">No asset packs yet.</p>}
              {packs.map((pack) => (
                <button key={pack.id} type="button" onClick={() => setActivePack(pack)} className={`rounded-2xl border p-3 text-left transition ${activePack?.id === pack.id ? 'border-os-accent bg-blue-50/60' : 'border-black/10 hover:border-black/25'}`}>
                  <span className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 text-sm font-semibold text-os-text">{pack.title}</span>
                    <span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-wide ${statusClass(pack.status)}`}>{pack.status}</span>
                  </span>
                  <span className="mt-2 block text-xs text-os-muted">{pack.assets.length} assets · {formatDate(pack.created_at)}</span>
                </button>
              ))}
            </div>
          </section>

          {activePack && (
            <section className="rounded-3xl border border-black/10 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-os-muted">Review</p>
                  <h2 className="mt-1 text-lg font-semibold">{activePack.title}</h2>
                </div>
                <span className={`rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-wide ${statusClass(activePack.status)}`}>{activePack.status}</span>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm text-os-muted">{activePack.brief}</p>
              {activePack.channels.length > 0 && <p className="mt-3 text-xs text-os-muted">Channels: {activePack.channels.join(', ')}</p>}
              {activePack.notes && <p className="mt-3 rounded-xl bg-os-bg p-3 text-xs text-os-muted">{activePack.notes}</p>}
              <div className="mt-5 grid gap-3">
                {activePack.assets.map((asset) => (
                  <div key={asset.public_id} className="flex gap-3 rounded-2xl border border-black/10 p-2">
                    <img src={asset.preview_url} alt={asset.filename} className="h-14 w-14 rounded-xl object-cover" />
                    <div className="min-w-0 py-1">
                      <p className="truncate text-sm font-medium text-os-text">{asset.filename}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-os-muted">{asset.rationale || asset.usage_rights || 'Selected candidate'}</p>
                      {asset.variants.length > 0 && <p className="mt-1 text-[11px] text-os-muted">{asset.variants.map((variant) => variant.label).join(', ')}</p>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {activePack.status === 'draft' && (
                  <>
                    <button type="button" disabled={reviewStatus === 'saving'} onClick={() => void reviewPack('approved')} className="rounded-xl bg-os-accent px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-600 disabled:opacity-60">Approve pack</button>
                    <button type="button" disabled={reviewStatus === 'saving'} onClick={() => void reviewPack('rejected')} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60">Reject</button>
                  </>
                )}
                {activePack.status === 'approved' && <a href={`/api/asset-packs/${activePack.id}`} target="_blank" rel="noreferrer" className="rounded-xl border border-black/10 bg-os-bg px-3 py-2 text-xs font-semibold text-os-text transition hover:bg-white">Open JSON manifest</a>}
              </div>
            </section>
          )}
        </aside>
      </main>
    </div>
  );
}
