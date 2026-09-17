'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AGENT_SCOPES, DEFAULT_AGENT_SCOPES, type AgentScope } from '@/lib/agent-scopes';
import type { AgentApiKeyRecord } from '@/lib/agent-keys';

type KeyResponse = {
  keys?: AgentApiKeyRecord[];
  key?: AgentApiKeyRecord;
  token?: string;
  error?: string;
};

const SCOPE_LABELS: Record<AgentScope, string> = {
  'assets:read': 'Search assets',
  'asset_packs:read': 'Read approved packs',
  'asset_packs:write': 'Create draft packs',
  'asset_packs:approve': 'Approve draft packs',
};

export default function AgentSettingsPage() {
  const [keys, setKeys] = useState<AgentApiKeyRecord[]>([]);
  const [name, setName] = useState('Marketing assistant');
  const [scopes, setScopes] = useState<AgentScope[]>([...DEFAULT_AGENT_SCOPES]);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/agent-keys', { cache: 'no-store' });
      const data = await response.json() as KeyResponse;
      if (!response.ok) throw new Error(data.error || 'Unable to load agent keys.');
      setKeys(data.keys ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load agent keys.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  function toggleScope(scope: AgentScope) {
    setScopes((current) => current.includes(scope)
      ? current.filter((entry) => entry !== scope)
      : [...current, scope]);
  }

  async function createKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setToken(null);
    try {
      const response = await fetch('/api/agent-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, scopes }),
      });
      const data = await response.json() as KeyResponse;
      if (!response.ok || !data.key || !data.token) {
        throw new Error(data.error || 'Unable to create agent key.');
      }
      setKeys((current) => [data.key as AgentApiKeyRecord, ...current]);
      setToken(data.token);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to create agent key.');
    } finally {
      setSaving(false);
    }
  }

  async function revokeKey(id: string) {
    if (!window.confirm('Revoke this key? Connected agents will immediately lose access.')) return;
    setError(null);
    try {
      const response = await fetch('/api/agent-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await response.json() as KeyResponse;
      if (!response.ok) throw new Error(data.error || 'Unable to revoke agent key.');
      setKeys((current) => current.map((key) => key.id === id
        ? { ...key, revoked_at: new Date().toISOString() }
        : key));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to revoke agent key.');
    }
  }

  async function copyToken() {
    if (!token) return;
    await navigator.clipboard.writeText(token);
  }

  return (
    <div className="min-h-screen bg-os-bg text-os-text">
      <header className="border-b border-black/5 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-os-muted">PixelSky</p>
            <h1 className="text-2xl font-semibold">Agent access</h1>
          </div>
          <Link href="/" className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-os-text transition hover:bg-os-bg">
            Back to DAM
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
        <section className="rounded-3xl border border-black/10 bg-white p-6">
          <p className="max-w-2xl text-sm leading-6 text-os-muted">
            Create a scoped key for one trusted agent connection. Agents can search assets, return direct download links,
            and create drafts. Approval is available only when you explicitly grant the separate approval permission.
            Keys are shown once and cannot be recovered.
          </p>
          <form onSubmit={createKey} className="mt-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <label className="grid gap-2 text-sm font-medium">
              Key name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm font-normal outline-none focus:border-os-accent focus:ring-2 focus:ring-os-accent/20"
              />
            </label>
            <button
              type="submit"
              disabled={saving || scopes.length === 0}
              className="h-11 rounded-xl bg-os-accent px-5 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create key'}
            </button>
            <fieldset className="md:col-span-2">
              <legend className="text-sm font-medium">Permissions</legend>
              <div className="mt-3 flex flex-wrap gap-3">
                {AGENT_SCOPES.map((scope) => (
                  <label key={scope} className="inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-2 text-xs text-os-muted">
                    <input
                      type="checkbox"
                      checked={scopes.includes(scope)}
                      onChange={() => toggleScope(scope)}
                      className="accent-os-accent"
                    />
                    {SCOPE_LABELS[scope]}
                  </label>
                ))}
              </div>
            </fieldset>
          </form>
        </section>

        {token && (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
            <p className="text-sm font-semibold text-amber-900">Copy this key now</p>
            <p className="mt-1 text-sm text-amber-800">It is only displayed once. Store it in your agent client&apos;s secret configuration.</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-amber-200 bg-white px-3 py-3 text-xs text-amber-950">
                {token}
              </code>
              <button type="button" onClick={copyToken} className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100">
                Copy key
              </button>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-black/10 bg-white p-6">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Connection endpoint</h2>
              <p className="mt-1 text-sm text-os-muted">Use this remote MCP URL with a bearer key.</p>
            </div>
            <code className="rounded-lg bg-os-bg px-3 py-2 text-xs">https://light-dam-v1.vercel.app/api/mcp</code>
          </div>
          <p className="mt-4 text-sm leading-6 text-os-muted">
            This first release is designed for MCP clients that support a static bearer token, such as Claude Code and Codex-compatible clients.
            A browser-style OAuth connection for a one-click ChatGPT app is the next integration phase.
          </p>
        </section>

        <section className="rounded-3xl border border-black/10 bg-white p-6">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Agent keys</h2>
              <p className="mt-1 text-sm text-os-muted">Revoke any key to immediately cut off its access.</p>
            </div>
            <button type="button" onClick={() => void loadKeys()} className="text-sm font-semibold text-os-accent hover:underline">Refresh</button>
          </div>
          {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {loading ? (
            <p className="mt-6 text-sm text-os-muted">Loading keys...</p>
          ) : keys.length === 0 ? (
            <p className="mt-6 text-sm text-os-muted">No agent keys have been created.</p>
          ) : (
            <div className="mt-6 divide-y divide-black/5">
              {keys.map((key) => (
                <div key={key.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">{key.name}</p>
                    <p className="mt-1 font-mono text-xs text-os-muted">{key.token_prefix}...</p>
                    <p className="mt-2 text-xs text-os-muted">
                      {key.scopes.map((scope) => SCOPE_LABELS[scope]).join(' · ')}
                      {key.last_used_at ? ` · Last used ${new Date(key.last_used_at).toLocaleDateString()}` : ' · Never used'}
                    </p>
                  </div>
                  {key.revoked_at ? (
                    <span className="text-xs font-semibold text-os-muted">Revoked</span>
                  ) : (
                    <button type="button" onClick={() => void revokeKey(key.id)} className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50">
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
