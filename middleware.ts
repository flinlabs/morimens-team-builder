import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// The admin tooling (annotation editor, sync report, and their /api/admin
// handlers) is a local-development workflow only: you edit annotations locally,
// commit, and redeploy. None of it should be reachable on a deployed site, and
// the /api/admin handlers write to the filesystem, so leaving them open is a
// needless exposure. This middleware runs before any route, so it blocks both
// the pages and the API in one place — the handlers never execute in prod.
export function middleware(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return new NextResponse('Not found', { status: 404 })
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/admin/:path*'],
}