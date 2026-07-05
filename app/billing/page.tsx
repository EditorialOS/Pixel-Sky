'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useOrganization } from '@clerk/nextjs';

type BillingStatus = {
  active: boolean;
  status: string;
  priceId: string | null;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  error?: string;
};

export default function BillingPage() {
  const { organization } = useOrganization();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionStatus, setActionStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loadStatus = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/billing/status');
        const data = (await response.json()) as BillingStatus;
        if (!response.ok) {
          setStatus(null);
          setMessage(data.error || 'Unable to load billing status.');
          return;
        }
        setStatus(data);
      } catch (error) {
        console.error('Billing status error:', error);
        setMessage('Unable to load billing status.');
      } finally {
        setLoading(false);
      }
    };

    void loadStatus();
  }, []);

  const formattedTrial = useMemo(() => {
    if (!status?.trialEnd) return null;
    return new Date(status.trialEnd).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, [status?.trialEnd]);

  const formattedRenewal = useMemo(() => {
    if (!status?.currentPeriodEnd) return null;
    return new Date(status.currentPeriodEnd).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, [status?.currentPeriodEnd]);

  const startCheckout = async (plan: 'monthly' | 'yearly') => {
    setActionStatus('loading');
    setMessage('');
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await response.json();
      if (!response.ok) {
        setActionStatus('error');
        setMessage(data.error || 'Unable to start checkout.');
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      setActionStatus('error');
      setMessage('Unable to start checkout.');
    }
  };

  const openPortal = async () => {
    setActionStatus('loading');
    setMessage('');
    try {
      const response = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) {
        setActionStatus('error');
        setMessage(data.error || 'Unable to open billing portal.');
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Portal error:', error);
      setActionStatus('error');
      setMessage('Unable to open billing portal.');
    }
  };

  return (
    <div className="min-h-screen bg-os-bg text-os-text">
      <header className="border-b border-black/5 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-os-muted">Billing</p>
            <h1 className="text-2xl font-semibold">Plans and payments</h1>
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">{organization?.name || 'Workspace'} plan</h2>
              <p className="text-sm text-os-muted">
                Start a 7-day trial. Cancel anytime.
              </p>
            </div>
            {status?.active && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                Active
              </span>
            )}
          </div>

          {loading && (
            <p className="mt-4 text-sm text-os-muted">Loading billing status...</p>
          )}

          {!loading && status && (
            <div className="mt-4 rounded-2xl border border-black/10 bg-os-bg p-4 text-sm text-os-muted">
              <div>Status: {status.status}</div>
              {formattedTrial && <div>Trial ends: {formattedTrial}</div>}
              {formattedRenewal && <div>Renews on: {formattedRenewal}</div>}
            </div>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold">$16 / month</h3>
              <p className="mt-1 text-sm text-os-muted">Billed monthly. 7-day trial.</p>
              <button
                type="button"
                onClick={() => startCheckout('monthly')}
                disabled={actionStatus === 'loading'}
                className="mt-4 h-11 w-full rounded-xl bg-os-accent text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-black/20"
              >
                Start monthly trial
              </button>
            </div>
            <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold">$16 / month</h3>
              <p className="mt-1 text-sm text-os-muted">Billed yearly. 20% off.</p>
              <button
                type="button"
                onClick={() => startCheckout('yearly')}
                disabled={actionStatus === 'loading'}
                className="mt-4 h-11 w-full rounded-xl border border-black/10 bg-white text-sm font-semibold text-os-text shadow-sm transition hover:bg-os-bg disabled:cursor-not-allowed"
              >
                Start yearly plan
              </button>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={openPortal}
              disabled={actionStatus === 'loading'}
              className="h-11 rounded-xl border border-black/10 bg-white px-5 text-sm text-os-text shadow-sm transition hover:bg-os-bg disabled:cursor-not-allowed"
            >
              Manage billing
            </button>
            {message && (
              <span className="text-xs text-red-600">{message}</span>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
