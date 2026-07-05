'use client';

import Link from 'next/link';
import { OrganizationProfile } from '@clerk/nextjs';

export default function OrganizationPage() {
  return (
    <div className="min-h-screen bg-os-bg text-os-text">
      <header className="border-b border-black/5 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-os-muted">Workspace</p>
            <h1 className="text-2xl font-semibold">Manage your team</h1>
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
          <OrganizationProfile routing="path" path="/organization" />
        </div>
      </main>
    </div>
  );
}
