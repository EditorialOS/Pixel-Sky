import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-os-bg px-6 py-10 text-os-text">
      <div className="mx-auto max-w-3xl rounded-3xl border border-black/10 bg-white p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-semibold">Privacy Policy</h1>
          <Link href="/marketing" className="text-sm underline">
            Back
          </Link>
        </div>
        <div className="space-y-4 text-sm text-os-muted">
          <p>Last updated: February 22, 2026</p>
          <p>
            PixelSky collects account details, usage events, and billing metadata required to run
            the service. Uploaded assets remain in your connected Cloudinary account.
          </p>
          <p>
            We use Supabase for application data, Stripe for billing, and Clerk for authentication.
            These providers process data on our behalf to deliver the product.
          </p>
          <p>
            To request data deletion or export, contact support from the same email tied to your
            workspace account.
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
