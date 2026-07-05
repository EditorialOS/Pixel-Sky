'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useOrganization } from '@clerk/nextjs';

type CloudinarySettingsResponse = {
  connected?: boolean;
  cloudName?: string;
  apiKey?: string;
  folder?: string;
  error?: string;
};

export default function CloudinarySettingsPage() {
  const { organization } = useOrganization();
  const [isLoading, setIsLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [maskedKey, setMaskedKey] = useState('');
  const [form, setForm] = useState({
    cloudName: '',
    apiKey: '',
    apiSecret: '',
    folder: '',
  });
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [indexStatus, setIndexStatus] = useState<'idle' | 'running' | 'error'>('idle');
  const [indexMessage, setIndexMessage] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      setIsLoading(true);
      setStatus('idle');
      setMessage('');
      try {
        const response = await fetch('/api/settings/cloudinary');
        const data = (await response.json()) as CloudinarySettingsResponse;
        if (!response.ok) {
          setMessage(data.error || 'Unable to load settings.');
          setStatus('error');
          return;
        }
        if (data.connected) {
          setConnected(true);
          setMaskedKey(data.apiKey || '');
          setForm((prev) => ({
            ...prev,
            cloudName: data.cloudName || '',
            folder: data.folder || '',
          }));
        } else {
          setConnected(false);
          setMaskedKey('');
        }
      } catch (error) {
        console.error('Failed to load Cloudinary settings:', error);
        setMessage('Unable to load settings.');
        setStatus('error');
      } finally {
        setIsLoading(false);
      }
    };

    void loadSettings();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus('saving');
    setMessage('');
    try {
      const response = await fetch('/api/settings/cloudinary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = (await response.json()) as CloudinarySettingsResponse;
      if (!response.ok) {
        setStatus('error');
        setMessage(data.error || 'Unable to save settings.');
        return;
      }
      setStatus('success');
      setMessage('Cloudinary connected successfully.');
      setConnected(true);
      setForm((prev) => ({
        ...prev,
        apiKey: '',
        apiSecret: '',
      }));
    } catch (error) {
      console.error('Failed to save Cloudinary settings:', error);
      setStatus('error');
      setMessage('Unable to save settings.');
    }
  };

  const runIndex = async () => {
    setIndexStatus('running');
    setIndexMessage('');
    try {
      const response = await fetch('/api/ai/index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cursor: nextCursor || undefined }),
      });
      const data = await response.json();
      if (!response.ok) {
        setIndexStatus('error');
        setIndexMessage(data.error || 'Unable to build AI index.');
        return;
      }
      setNextCursor(data.next_cursor ?? null);
      setIndexStatus('idle');
      setIndexMessage(`Indexed ${data.indexed || 0} assets.`);
    } catch (error) {
      console.error('Indexing failed:', error);
      setIndexStatus('error');
      setIndexMessage('Unable to build AI index.');
    }
  };

  return (
    <div className="min-h-screen bg-os-bg text-os-text">
      <header className="border-b border-black/5 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-os-muted">Settings</p>
            <h1 className="text-2xl font-semibold">Cloudinary connection</h1>
          </div>
          <Link
            href="/"
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-os-text shadow-sm transition hover:bg-os-bg"
          >
            Back to DAM
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                {organization ? organization.name : 'Workspace'} connection
              </h2>
              <p className="text-sm text-os-muted">
                Bring your own Cloudinary account. Assets stay in your workspace.
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                connected
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {connected ? 'Connected' : 'Not connected'}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-xs text-os-muted">
                <span className="uppercase tracking-wide">Cloud name</span>
                <input
                  value={form.cloudName}
                  onChange={(event) => setForm((prev) => ({ ...prev, cloudName: event.target.value }))}
                  placeholder="your-cloud-name"
                  className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm text-os-text shadow-sm focus:border-os-accent focus:outline-none focus:ring-2 focus:ring-os-accent/20"
                />
              </label>
              <label className="grid gap-2 text-xs text-os-muted">
                <span className="uppercase tracking-wide">Folder (optional)</span>
                <input
                  value={form.folder}
                  onChange={(event) => setForm((prev) => ({ ...prev, folder: event.target.value }))}
                  placeholder="light-dam"
                  className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm text-os-text shadow-sm focus:border-os-accent focus:outline-none focus:ring-2 focus:ring-os-accent/20"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-xs text-os-muted">
                <span className="uppercase tracking-wide">API key</span>
                <input
                  value={form.apiKey}
                  onChange={(event) => setForm((prev) => ({ ...prev, apiKey: event.target.value }))}
                  placeholder={maskedKey || 'Enter your API key'}
                  className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm text-os-text shadow-sm focus:border-os-accent focus:outline-none focus:ring-2 focus:ring-os-accent/20"
                />
              </label>
              <label className="grid gap-2 text-xs text-os-muted">
                <span className="uppercase tracking-wide">API secret</span>
                <input
                  type="password"
                  value={form.apiSecret}
                  onChange={(event) => setForm((prev) => ({ ...prev, apiSecret: event.target.value }))}
                  placeholder="Enter your API secret"
                  className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm text-os-text shadow-sm focus:border-os-accent focus:outline-none focus:ring-2 focus:ring-os-accent/20"
                />
              </label>
            </div>

            <p className="text-xs text-os-muted">
              For security, you must re-enter the API key and secret when updating the connection.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={status === 'saving' || isLoading}
                className="h-11 rounded-xl bg-os-accent px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-black/20"
              >
                {status === 'saving' ? 'Saving...' : 'Save connection'}
              </button>
              <a
                href="https://cloudinary.com/console"
                target="_blank"
                rel="noreferrer"
                className="h-11 rounded-xl border border-black/10 bg-white px-5 text-sm text-os-text shadow-sm transition hover:bg-os-bg"
              >
                Open Cloudinary
              </a>
            </div>

            {status !== 'idle' && message && (
              <div
                className={`rounded-2xl border px-4 py-3 text-xs ${
                  status === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : status === 'error'
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-blue-200 bg-blue-50 text-blue-700'
                }`}
              >
                {message}
              </div>
            )}
          </form>
        </div>

        <div className="mt-6 rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">AI search index</h2>
              <p className="text-sm text-os-muted">
                Build semantic search for your workspace assets.
              </p>
            </div>
            <button
              type="button"
              onClick={runIndex}
              disabled={indexStatus === 'running'}
              className="h-11 rounded-xl bg-os-accent px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-black/20"
            >
              {indexStatus === 'running' ? 'Indexing...' : 'Build AI index'}
            </button>
          </div>
          {indexMessage && (
            <p className="mt-3 text-xs text-os-muted">{indexMessage}</p>
          )}
          {nextCursor && (
            <button
              type="button"
              onClick={runIndex}
              className="mt-3 text-xs font-semibold text-os-text underline"
            >
              Continue indexing
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
