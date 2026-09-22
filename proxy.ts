import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/marketing(.*)',
  '/legal(.*)',
  '/support(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/marketing/waitlist(.*)',
  '/api/mcp(.*)',
  '/api/mcp/oauth(.*)',
  '/api/figma/pair/start',
  '/api/figma/pair/claim',
  '/api/figma/search',
  '/api/figma/assets(.*)',
  '/api/figma/disconnect',
  '/api/figma/use(.*)',
  '/.well-known/oauth-protected-resource/api/mcp(.*)',
  '/.well-known/oauth-authorization-server(.*)',
  '/.well-known/openai-apps-challenge',
])

export default clerkMiddleware(async (auth, request) => {
  if (isPublicRoute(request)) return

  const { userId } = await auth()
  if (!userId) {
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.searchParams.set('redirect_url', request.url)
    return NextResponse.redirect(signInUrl)
  }
})

export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/api/(.*)'],
}
