'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type AuditLog = {
  id: string;
  action: string;
  details: Record<string, unknown>;
  user_id: string;
  created_at: string;
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  useEffect(() => {
    const loadLogs = async () => {
      setStatus('loading');
      try {
        const response = await fetch('/api/audit?limit=100');
        const data = await response.json();
        if (!response.ok) {
          setStatus('error');
          return;
        }
        setLogs(data.logs || []);
        setStatus('idle');
      } catch (error) {
        console.error('Failed to load audit logs:', error);
        setStatus('error');
      }
    };

    void loadLogs();
  }, []);

  return (
    <div className="min-h-screen bg-os-bg text-os-text">
      <header className="border-b border-black/5 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-os-muted">Audit</p>
            <h1 className="text-2xl font-semibold">Activity log</h1>
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
          {status === 'loading' && (
            <p className="text-sm text-os-muted">Loading audit logs...</p>
          )}
          {status === 'error' && (
            <p className="text-sm text-red-600">Unable to load audit logs.</p>
          )}
          {status === 'idle' && logs.length === 0 && (
            <p className="text-sm text-os-muted">No activity yet.</p>
          )}
          {logs.length > 0 && (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-black/10 bg-os-bg p-4 text-sm text-os-text"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-semibold capitalize">{log.action.replace('_', ' ')}</div>
                    <div className="text-xs text-os-muted">
                      {new Date(log.created_at).toLocaleString('en-US')}
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-os-muted">
                    User: {log.user_id}
                  </div>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <pre className="mt-3 whitespace-pre-wrap rounded-xl border border-black/10 bg-white p-3 text-xs text-os-muted">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
