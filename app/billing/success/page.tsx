'use client';

import Link from 'next/link';

export default function BillingSuccessPage() {
  return (
    <div className="min-h-screen bg-os-bg text-os-text">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-12">
        <div className="w-full rounded-3xl border border-black/10 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold">You’re all set</h1>
          <p className="mt-2 text-sm text-os-muted">
            Your subscription is active. You can continue managing assets.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="rounded-full bg-os-accent px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
            >
              Go to PixelSky
            </Link>
            <Link
              href="/billing"
              className="rounded-full border border-black/10 bg-white px-5 py-2 text-sm text-os-text shadow-sm transition hover:bg-os-bg"
            >
              View billing
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
