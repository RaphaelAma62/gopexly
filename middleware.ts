import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip middleware entirely for these — never redirect them
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/auth/') ||
    pathname.includes('.') // any file with extension (.html, .ico, .png etc)
  ) {
    return NextResponse.next()
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — keeps auth token alive automatically
  const { data: { user } } = await supabase.auth.getUser()

  // Protected app routes — must be logged in
  const isProtected =
    pathname.startsWith('/home') ||
    pathname.startsWith('/market') ||
    pathname.startsWith('/portfolio') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/learn') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/notifications') ||
    pathname.startsWith('/search') ||
    pathname.startsWith('/watchlist') ||
    pathname.startsWith('/alerts') ||
    pathname.startsWith('/bookmarks') ||
    pathname.startsWith('/leaderboard') ||
    pathname.startsWith('/pro') ||
    pathname.startsWith('/screener') ||
    pathname.startsWith('/clubs') ||
    pathname.startsWith('/messaging') ||
    pathname.startsWith('/referral') ||
    pathname.startsWith('/stocks') ||
    pathname.startsWith('/about') ||
    pathname.startsWith('/contact')

  // Not logged in → redirect to landing page
  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // Logged in + on landing page → go to app
  if (user && pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/home'
    return NextResponse.redirect(url)
  }

  // Admin routes — check role
  if (user && pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'editor'].includes(profile.role)) {
      const url = request.nextUrl.clone()
      url.pathname = '/home'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|html|css|js)$).*)',
  ],
}