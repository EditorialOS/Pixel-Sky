'use client';

import Link from 'next/link';
import { CreateOrganization, useOrganization } from '@clerk/nextjs';

export default function OnboardingPage() {
  const { organization } = useOrganization();

  if (organization) {
    return (
      <div className="min-h-screen bg-os-bg text-os-text">
        <div className="mx-auto flex min-h-screen max-w-4xl items-center justify-center px-6 py-12">
          <div className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-6 text-center shadow-sm">
            <h1 className="text-2xl font-semibold">Workspace ready</h1>
            <p className="mt-2 text-sm text-os-muted">
              You already have an active workspace. Jump back to your DAM.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex rounded-full bg-os-accent px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600"
            >
              Open PixelSky
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-os-bg text-os-text">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Create your workspace</h1>
          <p className="mt-2 text-sm text-os-muted">
            Workspaces keep your assets and team members together.
          </p>
          <div className="mt-6">
            <CreateOrganization
              appearance={{
                elements: {
                  card: 'shadow-none border border-black/10',
                },
              }}
              routing="path"
              path="/onboarding"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
