import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-os-bg px-6 py-10 text-os-text">
      <div className="mx-auto max-w-3xl rounded-3xl border border-black/10 bg-white p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-semibold">Terms of Service</h1>
          <Link href="/marketing" className="text-sm underline">
            Back
          </Link>
        </div>
        <div className="space-y-4 text-sm text-os-muted">
          <p>Last updated: February 22, 2026</p>
          <p>
            PixelSky is provided as a subscription software service for managing and searching
            marketing assets. You are responsible for content uploaded to your Cloudinary account.
          </p>
          <p>
            Paid access and trial terms are handled through Stripe. Subscription renewal, billing
            cycle dates, and cancellation state are reflected in your workspace billing settings.
          </p>
          <p>
            We may suspend accounts for abuse, non-payment, or security risk. Service usage must
            comply with applicable law and third-party platform policies.
          </p>
          <p>
            This page is a product template and should be reviewed by legal counsel before general
            availability.
          </p>
        </div>
      </div>
    </main>
  );
}
