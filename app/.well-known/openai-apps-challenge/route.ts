export const runtime = 'nodejs';

export async function GET() {
  const challenge = process.env.OPENAI_APPS_CHALLENGE?.trim();
  if (!challenge) {
    return new Response('Domain verification is not active.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  return new Response(challenge, {
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
