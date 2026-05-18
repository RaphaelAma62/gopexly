import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            // Set cookies with maximum secure lifetime (1 year)
            supabaseResponse.cookies.set(name, value, {
              ...options,
              maxAge: 60 * 60 * 24 * 365, // 1 year in seconds
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              path: '/',
            })
          })
        },
      },
    }
  )

  // Refresh session — keeps token alive automatically
  const { data: { user } } = await supabase.auth.getUser()

  // Protect app routes — redirect to home if not logged in
  const isAppRoute = request.nextUrl.pathname.startsWith('/home') ||
    request.nextUrl.pathname.startsWith('/market') ||
    request.nextUrl.pathname.startsWith('/portfolio') ||
    request.nextUrl.pathname.startsWith('/profile') ||
    request.nextUrl.pathname.startsWith('/learn') ||
    request.nextUrl.pathname.startsWith('/admin') ||
    request.nextUrl.pathname.startsWith('/notifications') ||
    request.nextUrl.pathname.startsWith('/search') ||
    request.nextUrl.pathname.startsWith('/watchlist') ||
    request.nextUrl.pathname.startsWith('/alerts') ||
    request.nextUrl.pathname.startsWith('/bookmarks') ||
    request.nextUrl.pathname.startsWith('/leaderboard') ||
    request.nextUrl.pathname.startsWith('/pro') ||
    request.nextUrl.pathname.startsWith('/screener') ||
    request.nextUrl.pathname.startsWith('/clubs') ||
    request.nextUrl.pathname.startsWith('/messaging') ||
    request.nextUrl.pathname.startsWith('/referral') ||
    request.nextUrl.pathname.startsWith('/stocks')

  if (isAppRoute && !user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/'
    return NextResponse.redirect(redirectUrl)
  }

  // If logged in and on landing page, redirect to /home
  if (request.nextUrl.pathname === '/' && user) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/home'
    return NextResponse.redirect(redirectUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|html|css|js)$).*)',
  ],
}