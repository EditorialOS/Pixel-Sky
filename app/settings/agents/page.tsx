'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AGENT_SCOPES, DEFAULT_AGENT_SCOPES, type AgentScope } from '@/lib/agent-scopes';
import type { AgentApiKeyRecord } from '@/lib/agent-keys';
import type { AgentConnectionRecord } from '@/lib/agent-connections';

type KeyResponse = {
  keys?: AgentApiKeyRecord[];
  key?: AgentApiKeyRecord;
  token?: string;
  error?: string;
};

type ConnectionResponse = {
  connections?: AgentConnectionRecord[];
  connection?: AgentConnectionRecord;
  endpoint?: string;
  oauthReady?: boolean;
  error?: string;
};

const SCOPE_LABELS: Record<AgentScope, string> = {
  'assets:read': 'Search assets',
  'asset_packs:read': 'Read approved packs',
  'asset_packs:write': 'Create draft packs',
  'asset_packs:approve': 'Approve draft packs',
};

function endpointFor(connection: AgentConnectionRecord) {
  return `${window.location.origin}/api/mcp/${connection.id}`;
}

export default function AgentSettingsPage() {
  const [connections, setConnections] = useState<AgentConnectionRecord[]>([]);
  const [connectionName, setConnectionName] = useState('PixelSky for ChatGPT');
  const [connectionScopes, setConnectionScopes] = useState<AgentScope[]>([...DEFAULT_AGENT_SCOPES]);
  const [connectionEndpoint, setConnectionEndpoint] = useState<string | null>(null);
  const [oauthReady, setOauthReady] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionLoading, setConnectionLoading] = useState(true);
  const [connectionSaving, setConnectionSaving] = useState(false);

  const [keys, setKeys] = useState<AgentApiKeyRecord[]>([]);
  const [name, setName] = useState('Technical MCP client');
  const [scopes, setScopes] = useState<AgentScope[]>([...DEFAULT_AGENT_SCOPES]);
  const [token, setToken] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keyLoading, setKeyLoading] = useState(true);
  const [keySaving, setKeySaving] = useState(false);

  const loadConnections = useCallback(async () => {
    setConnectionLoading(true);
    setConnectionError(null);
    try {
      const response = await fetch('/api/agent-connections', { cache: 'no-store' });
      const data = await response.json() as ConnectionResponse;
      if (!response.ok) throw new Error(data.error || 'Unable to load chat connections.');
      setConnections(data.connections ?? []);
      setOauthReady(Boolean(data.oauthReady));
    } catch (requestError) {
      setConnectionError(requestError instanceof Error ? requestError.message : 'Unable to load chat connections.');
    } finally {
      setConnectionLoading(false);
    }
  }, []);

  const loadKeys = useCallback(async () => {
    setKeyLoading(true);
    setKeyError(null);
    try {
      const response = await fetch('/api/agent-keys', { cache: 'no-store' });
      const data = await response.json() as KeyResponse;
      if (!response.ok) throw new Error(data.error || 'Unable to load agent keys.');
      setKeys(data.keys ?? []);
    } catch (requestError) {
      setKeyError(requestError instanceof Error ? requestError.message : 'Unable to load agent keys.');
    } finally {
      setKeyLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConnections();
    void loadKeys();
  }, [loadConnections, loadKeys]);

  function toggleConnectionScope(scope: AgentScope) {
    setConnectionScopes((current) => current.includes(scope)
      ? current.filter((entry) => entry !== scope)
      : [...current, scope]);
  }

  function toggleScope(scope: AgentScope) {
    setScopes((current) => current.includes(scope)
      ? current.filter((entry) => entry !== scope)
      : [...current, scope]);
  }

  async function createConnection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConnectionSaving(true);
    setConnectionError(null);
    setConnectionEndpoint(null);
    try {
      const response = await fetch('/api/agent-connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: connectionName, scopes: connectionScopes }),
      });
      const data = await response.json() as ConnectionResponse;
      if (!response.ok || !data.connection || !data.endpoint) {
        throw new Error(data.error || 'Unable to create a chat connection.');
      }
      setConnections((current) => [data.connection as AgentConnectionRecord, ...current]);
      setConnectionEndpoint(data.endpoint);
      setOauthReady(Boolean(data.oauthReady));
    } catch (requestError) {
      setConnectionError(requestError instanceof Error ? requestError.message : 'Unable to create a chat connection.');
    } finally {
      setConnectionSaving(false);
    }
  }

  async function revokeConnection(id: string) {
    if (!window.confirm('Revoke this chat connection? Every connected team member will immediately lose access.')) return;
    setConnectionError(null);
    try {
      const response = await fetch('/api/agent-connections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await response.json() as ConnectionResponse;
      if (!response.ok) throw new Error(data.error || 'Unable to revoke the chat connection.');
      setConnections((current) => current.map((connection) => connection.id === id
        ? { ...connection, revoked_at: new Date().toISOString() }
        : connection));
    } catch (requestError) {
      setConnectionError(requestError instanceof Error ? requestError.message : 'Unable to revoke the chat connection.');
    }
  }

  async function createKey(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setKeySaving(true);
    setKeyError(null);
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
      setKeyError(requestError instanceof Error ? requestError.message : 'Unable to create agent key.');
    } finally {
      setKeySaving(false);
    }
  }

  async function revokeKey(id: string) {
    if (!window.confirm('Revoke this key? Connected agents will immediately lose access.')) return;
    setKeyError(null);
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
      setKeyError(requestError instanceof Error ? requestError.message : 'Unable to revoke agent key.');
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
  }

  return (
    <div className="min-h-screen bg-os-bg text-os-text">
      <header className="border-b border-black/5 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-os-muted">PixelSky</p>
            <h1 className="text-2xl font-semibold">Connect chat apps</h1>
          </div>
          <Link href="/" className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-os-text transition hover:bg-os-bg">
            Back to DAM
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-10">
        <section className="rounded-3xl border border-black/10 bg-white p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-os-accent">No developer key</p>
              <h2 className="mt-2 text-xl font-semibold">Use PixelSky inside ChatGPT</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-os-muted">
                Create one connection for this workspace, paste its endpoint into a ChatGPT custom app once, then each teammate signs in with their own PixelSky account. No API key is copied or shared.
              </p>
            </div>
            <span className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-medium ${oauthReady ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              {oauthReady ? 'OAuth ready' : 'OAuth setup pending'}
            </span>
          </div>

          <ol className="mt-6 grid gap-3 text-sm text-os-muted md:grid-cols-3">
            <li className="rounded-2xl border border-black/5 bg-os-surface p-4"><span className="font-semibold text-os-text">1. Create</span><br />Choose what the chat connection can do.</li>
            <li className="rounded-2xl border border-black/5 bg-os-surface p-4"><span className="font-semibold text-os-text">2. Add to ChatGPT</span><br />Enable Developer Mode, create a custom app, and paste the endpoint.</li>
            <li className="rounded-2xl border border-black/5 bg-os-surface p-4"><span className="font-semibold text-os-text">3. Sign in</span><br />Each team member authorizes their own PixelSky access.</li>
          </ol>

          {!oauthReady && (
            <p className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              The install flow is built but cannot be used until the one-time PixelSky OAuth provider setup is completed. Existing static-key integrations continue to work below.
            </p>
          )}

          <form onSubmit={createConnection} className="mt-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <label className="grid gap-2 text-sm font-medium">
              Connection name
              <input
                value={connectionName}
                onChange={(event) => setConnectionName(event.target.value)}
                maxLength={120}
                className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm font-normal outline-none focus:border-os-accent focus:ring-2 focus:ring-os-accent/20"
              />
            </label>
            <button
              type="submit"
              disabled={connectionSaving || connectionScopes.length === 0}
              className="h-11 rounded-xl bg-os-accent px-5 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {connectionSaving ? 'Creating...' : 'Create connection'}
            </button>
            <fieldset className="md:col-span-2">
              <legend className="text-sm font-medium">Permissions</legend>
              <div className="mt-3 flex flex-wrap gap-3">
                {AGENT_SCOPES.map((scope) => (
                  <label key={scope} className="inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-2 text-xs text-os-muted">
                    <input
                      type="checkbox"
                      checked={connectionScopes.includes(scope)}
                      onChange={() => toggleConnectionScope(scope)}
                      className="accent-os-accent"
                    />
                    {SCOPE_LABELS[scope]}
                  </label>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-os-muted">Approval is intentionally off by default. Enable it only when this chat connection may approve packs without a human review step.</p>
            </fieldset>
          </form>

          {connectionEndpoint && (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-900">Paste this into ChatGPT&apos;s custom app endpoint field</p>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                <code className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-emerald-200 bg-white px-3 py-3 text-xs text-emerald-950">{connectionEndpoint}</code>
                <button type="button" onClick={() => void copy(connectionEndpoint)} className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-100">Copy endpoint</button>
              </div>
            </div>
          )}

          {connectionError && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{connectionError}</p>}
        </section>

        <section className="rounded-3xl border border-black/10 bg-white p-6">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Workspace chat connections</h2>
              <p className="mt-1 text-sm text-os-muted">Only signed-in members of this PixelSky workspace can use a connection.</p>
            </div>
            <button type="button" onClick={() => void loadConnections()} className="text-sm font-semibold text-os-accent hover:underline">Refresh</button>
          </div>
          {connectionLoading ? (
            <p className="mt-6 text-sm text-os-muted">Loading connections...</p>
          ) : connections.length === 0 ? (
            <p className="mt-6 text-sm text-os-muted">No chat connections have been created.</p>
          ) : (
            <div className="mt-6 divide-y divide-black/5">
              {connections.map((connection) => (
                <div key={connection.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{connection.name}</p>
                    <p className="mt-1 text-xs text-os-muted">{connection.scopes.map((scope) => SCOPE_LABELS[scope]).join(' · ')}</p>
                    {!connection.revoked_at && <code className="mt-2 block max-w-full overflow-x-auto text-xs text-os-muted">{endpointFor(connection)}</code>}
                  </div>
                  {connection.revoked_at ? (
                    <span className="text-xs font-semibold text-os-muted">Revoked</span>
                  ) : (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void copy(endpointFor(connection))} className="rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold text-os-text transition hover:bg-os-bg">Copy</button>
                      <button type="button" onClick={() => void revokeConnection(connection.id)} className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50">Revoke</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <details className="rounded-3xl border border-black/10 bg-white p-6">
          <summary className="cursor-pointer text-lg font-semibold">Advanced: static key for technical MCP clients</summary>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-os-muted">
            Use this only for tools that cannot open a browser sign-in flow. The key is displayed once, must be stored as a secret, and gives the connected client exactly the permissions selected below.
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
            <button type="submit" disabled={keySaving || scopes.length === 0} className="h-11 rounded-xl bg-os-accent px-5 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50">
              {keySaving ? 'Creating...' : 'Create key'}
            </button>
            <fieldset className="md:col-span-2">
              <legend className="text-sm font-medium">Permissions</legend>
              <div className="mt-3 flex flex-wrap gap-3">
                {AGENT_SCOPES.map((scope) => (
                  <label key={scope} className="inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-2 text-xs text-os-muted">
                    <input type="checkbox" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} className="accent-os-accent" />
                    {SCOPE_LABELS[scope]}
                  </label>
                ))}
              </div>
            </fieldset>
          </form>

          {token && (
            <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">Copy this key now</p>
              <p className="mt-1 text-sm text-amber-800">It is only displayed once. Store it in your agent client&apos;s secret configuration.</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <code className="min-w-0 flex-1 overflow-x-auto rounded-xl border border-amber-200 bg-white px-3 py-3 text-xs text-amber-950">{token}</code>
                <button type="button" onClick={() => void copy(token)} className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100">Copy key</button>
              </div>
            </section>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold">Static-key endpoint</h3>
              <code className="mt-2 inline-block rounded-lg bg-os-bg px-3 py-2 text-xs">https://light-dam-v1.vercel.app/api/mcp</code>
            </div>
            <button type="button" onClick={() => void loadKeys()} className="text-sm font-semibold text-os-accent hover:underline">Refresh keys</button>
          </div>
          {keyError && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{keyError}</p>}
          {keyLoading ? (
            <p className="mt-6 text-sm text-os-muted">Loading keys...</p>
          ) : keys.length === 0 ? (
            <p className="mt-6 text-sm text-os-muted">No static agent keys have been created.</p>
          ) : (
            <div className="mt-6 divide-y divide-black/5">
              {keys.map((key) => (
                <div key={key.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">{key.name}</p>
                    <p className="mt-1 font-mono text-xs text-os-muted">{key.token_prefix}...</p>
                    <p className="mt-2 text-xs text-os-muted">{key.scopes.map((scope) => SCOPE_LABELS[scope]).join(' · ')}{key.last_used_at ? ` · Last used ${new Date(key.last_used_at).toLocaleDateString()}` : ' · Never used'}</p>
                  </div>
                  {key.revoked_at ? <span className="text-xs font-semibold text-os-muted">Revoked</span> : <button type="button" onClick={() => void revokeKey(key.id)} className="rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50">Revoke</button>}
                </div>
              ))}
            </div>
          )}
        </details>
      </main>
    </div>
  );
}
