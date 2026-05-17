import { NextResponse } from 'next/server'

// No auth checks in middleware — let pages handle their own auth
// This prevents session timing issues on Render
export function middleware() {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
