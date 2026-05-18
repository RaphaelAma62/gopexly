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

  const hasAuthCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-'))

  // Public routes with no Supabase session cookie should avoid the auth network call.
  if (!isProtected && !(pathname === '/' && hasAuthCookie)) {
    return NextResponse.next()
  }

  // Protected routes without a session cookie can redirect immediately.
  if (isProtected && !hasAuthCookie) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options) {
          request.cookies.set(name, value)
          supabaseResponse = NextResponse.next({ request })
          supabaseResponse.cookies.set(name, value, options)
        },
        remove(name: string, options) {
          request.cookies.set(name, '')
          supabaseResponse = NextResponse.next({ request })
          supabaseResponse.cookies.set(name, '', { ...options, maxAge: 0 })
        },
      },
    }
  )

  // Refresh session only when the route needs auth or an existing session may redirect.
  const { data: { user } } = await supabase.auth.getUser()

  // Not logged in → redirect to landing page
  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie)
    })
    return redirectResponse
  }

  // Logged in + on landing page → go to app
  if (user && pathname === '/') {
    const url = request.nextUrl.clone()
    url.pathname = '/home'
    const redirectResponse = NextResponse.redirect(url)
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie)
    })
    return redirectResponse
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
      const redirectResponse = NextResponse.redirect(url)
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie)
      })
      return redirectResponse
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|html|css|js)$).*)',
  ],
}