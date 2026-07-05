import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

type WaitlistPayload = {
  email?: string;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  let payload: WaitlistPayload;
  try {
    payload = (await request.json()) as WaitlistPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const rawEmail = payload.email ?? '';
  const email = normalizeEmail(rawEmail);
  if (!email || !EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json(
      { error: 'Waitlist is temporarily unavailable.' },
      { status: 503 },
    );
  }

  const { error } = await (supabase as any)
    .from('waitlist_signups')
    .upsert(
      [
        {
          email,
          source: 'marketing',
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: 'email' },
    );

  if (error) {
    console.error('Waitlist insert error:', error);
    return NextResponse.json(
      { error: 'Unable to save your email right now.' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
