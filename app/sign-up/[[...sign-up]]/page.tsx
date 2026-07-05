'use client';

import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-os-bg text-os-text">
      <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Create your account</h1>
          <p className="mt-2 text-sm text-os-muted">Start your PixelSky workspace.</p>
          <div className="mt-6">
            <SignUp routing="path" path="/sign-up" />
          </div>
        </div>
      </div>
    </div>
  );
}
