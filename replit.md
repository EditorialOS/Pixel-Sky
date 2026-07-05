# PixelSky for Replit

PixelSky is a lightweight digital asset manager for small teams.

## Run

```bash
npm install
npm run dev
```

## What to configure

Set these in Replit Secrets before running the app:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_PRICE_MONTHLY_ID`
- `STRIPE_WEBHOOK_SECRET`
- `OPENAI_API_KEY`

## What it does

- Authenticated DAM app for browsing, searching, uploading, and downloading assets
- Cloudinary is the asset source of truth
- Supabase stores workspace config, audit logs, billing state, and embeddings
- Stripe handles trials and paid subscriptions

## Notes

- The marketing page is public at `/marketing`.
- The main app is protected behind Clerk authentication.
- If AI search is used, run the AI index builder in `/settings/cloudinary`.
