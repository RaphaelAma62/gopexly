'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { validateUsername } from '@/lib/utils'

type AuthMode = 'signin' | 'signup'
type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

interface SignUpData {
  firstName: string; lastName: string; username: string
  phone: string; email: string; password: string
}

export default function LandingPage() {
  const sb = createClient()
  const [mode, setMode] = useState<AuthMode>('signin')
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [signupDone, setSignupDone] = useState(false)
  const [siEmail, setSiEmail] = useState('')
  const [siPassword, setSiPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [suData, setSuData] = useState<SignUpData>({
    firstName: '', lastName: '', username: '', phone: '', email: '', password: ''
  })
  const [unStatus, setUnStatus] = useState<UsernameStatus>('idle')
  const [unMsg, setUnMsg] = useState('')
  const unTimer = useRef<NodeJS.Timeout | null>(null)

  function openModal(m: AuthMode) { setMode(m); setModalOpen(true); setError('') }

  async function checkUsername(val: string) {
    const clean = val.toLowerCase().replace(/[^a-z0-9_]/g, '')
    setSuData(prev => ({ ...prev, username: clean }))
    if (unTimer.current) clearTimeout(unTimer.current)
    const err = validateUsername(clean)
    if (!clean) { setUnStatus('idle'); setUnMsg(''); return }
    if (err) { setUnStatus('invalid'); setUnMsg(err); return }
    setUnStatus('checking'); setUnMsg('Checking availability...')
    unTimer.current = setTimeout(async () => {
      try {
        const { data } = await sb.from('profiles').select('id').eq('username', clean).maybeSingle()
        setUnStatus(data ? 'taken' : 'available')
        setUnMsg(data ? `@${clean} is already taken` : `@${clean} is available!`)
      } catch { setUnStatus('available'); setUnMsg(`@${clean} is available!`) }
    }, 500)
  }

  // ── SIGN IN ──────────────────────────────────
  async function doSignIn(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (!siEmail || !siPassword) { setError('Please enter your email and password.'); return }
    setLoading(true)
    try {
      // Set session persistence based on Remember Me
      // Supabase uses localStorage by default which persists — this is the secure approach
      const { data, error: authErr } = await sb.auth.signInWithPassword({
        email: siEmail.trim(), password: siPassword
      })
      if (authErr) { setError('Incorrect email or password.'); setLoading(false); return }
      if (data.session) {
        if (!rememberMe) {
          // Session-only: store a flag so middleware knows to expire on tab close
          sessionStorage.setItem('gopexly_session_only', 'true')
        } else {
          // Remember me: clear any session-only flag
          sessionStorage.removeItem('gopexly_session_only')
        }
        await new Promise(r => setTimeout(r, 800))
        window.location.href = '/home'
      } else {
        setError('Login failed. Please try again.')
        setLoading(false)
      }
    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  // ── SIGN UP ──────────────────────────────────
  async function doSignUp(e: React.FormEvent) {
    e.preventDefault(); setError('')
    const { firstName, lastName, username, phone, email, password } = suData
    if (!firstName) { setError('First name is required.'); return }
    if (!username || username.length < 3) { setError('Choose a username (min 3 characters).'); return }
    if (unStatus !== 'available') { setError('That username is not available.'); return }
    if (!phone) { setError('Phone number is required.'); return }
    if (!email) { setError('Email is required.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)
    try {
      const { data: existing } = await sb.from('profiles').select('id').eq('username', username).maybeSingle()
      if (existing) { setError(`@${username} was just taken. Choose another.`); setLoading(false); return }

      const { data, error: signUpErr } = await sb.auth.signUp({
        email: email.trim(), password,
        options: { data: { full_name: `${firstName} ${lastName}`.trim() } }
      })
      if (signUpErr) { setError(signUpErr.message); setLoading(false); return }
      if (!data.user) { setError('Something went wrong. Please try again.'); setLoading(false); return }

      const fullName = `${firstName} ${lastName}`.trim()
      const initials = firstName[0].toUpperCase() + (lastName ? lastName[0].toUpperCase() : '')
      await sb.from('profiles').upsert({
        id: data.user.id, name: fullName, first_name: firstName,
        initials, username, phone, joined_at: new Date().toISOString(),
      }, { onConflict: 'id' })

      // Add to Brevo
      try {
        await fetch('/api/brevo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), firstName, lastName }),
        })
      } catch (brevoErr) { console.error('Brevo error:', brevoErr) }

      if (data.session) {
        await new Promise(r => setTimeout(r, 1200))
        window.location.href = '/home'
      } else {
        setSignupDone(true); setLoading(false)
      }
    } catch (err) {
      console.error('Signup error:', err)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── NAVBAR ─────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 h-[64px] flex items-center bg-white/95 backdrop-blur-xl border-b border-gray-200">
        <div className="flex items-center justify-between w-full max-w-6xl mx-auto px-5">
          <div className="font-display text-[20px] font-extrabold flex items-center gap-2 text-gray-900">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white text-sm font-black">G</div>
            Gopexly
          </div>
          <div className="hidden md:flex items-center gap-6 text-[13px] font-medium text-gray-500">
            <a href="/about-us.html" className="hover:text-gray-900 transition-colors">About</a>
            <a href="/contact-us.html" className="hover:text-gray-900 transition-colors">Contact</a>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => openModal('signin')} className="text-[13px] font-semibold text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100 transition-all">
              Sign In
            </button>
            <button onClick={() => openModal('signup')} className="text-[13px] font-bold bg-primary text-white px-5 py-2.5 rounded-xl hover:bg-primary-dark transition-all shadow-sm">
              Get Started →
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────── */}
      <section className="pt-[120px] pb-20 px-5 text-center relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -right-20 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary-light text-primary text-[12px] font-bold px-4 py-1.5 rounded-full mb-6 border border-primary-border">
            🇳🇬 Built for African Investors
          </div>
          <h1 className="font-display text-[48px] md:text-[64px] font-black text-gray-900 leading-tight tracking-tight mb-6">
            Africa&apos;s Social<br/>
            <span className="text-primary">Investing Platform</span>
          </h1>
          <p className="text-[18px] text-gray-500 mb-10 leading-relaxed max-w-xl mx-auto">
            Track NGX stocks, share investment insights, and grow your wealth alongside a community of investors.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button onClick={() => openModal('signup')} className="bg-primary text-white text-[15px] font-bold px-8 py-4 rounded-2xl hover:bg-primary-dark transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5">
              Start Investing Free →
            </button>
            <button onClick={() => openModal('signin')} className="text-[15px] font-semibold text-gray-700 px-8 py-4 rounded-2xl border border-gray-200 hover:bg-gray-50 transition-all">
              Sign In
            </button>
          </div>
          <p className="text-[12px] text-gray-400 mt-4">Free forever · No credit card required</p>
        </div>
      </section>

      {/* ── STATS ──────────────────────────────── */}
      <section className="py-10 px-5 border-y border-gray-100 bg-gray-50">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { num: '124+', label: 'NGX Stocks Tracked' },
            { num: 'Live',  label: 'Real-Time Prices' },
            { num: '100%', label: 'Portfolio Privacy' },
            { num: 'Free', label: 'To Get Started' },
          ].map(s => (
            <div key={s.label}>
              <div className="font-display text-[28px] font-black text-primary">{s.num}</div>
              <div className="text-[12px] text-gray-500 uppercase tracking-wide mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────── */}
      <section className="py-20 px-5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-display text-[32px] font-extrabold text-gray-900 mb-3">Everything you need to invest smarter</h2>
            <p className="text-gray-500 text-[15px]">Built specifically for the Nigerian Exchange and African markets</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: '📈', title: 'Live NGX Prices',    desc: '124 stocks tracked in real-time from the Nigerian Exchange Group.' },
              { icon: '🤝', title: 'Social Feed',        desc: 'Share insights, post portfolio wins, tag stocks, and follow top investors.' },
              { icon: '💼', title: 'Portfolio Tracker',  desc: 'Track your holdings, see live P&L, set wealth goals. Your ₦ value is always private.' },
              { icon: '📚', title: 'Learn & Earn',       desc: 'Complete investing courses. Earn points and climb the leaderboard.' },
              { icon: '🤖', title: 'Gopex AI',           desc: 'Your personal NGX investing assistant. Ask anything about the market.' },
              { icon: '👑', title: 'Gopexly Pro',        desc: 'Screener, clubs, unlimited AI, direct messaging, and your verified badge.' },
            ].map(f => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-primary-border hover:shadow-md transition-all">
                <div className="text-[32px] mb-4">{f.icon}</div>
                <div className="font-display text-[15px] font-bold text-gray-900 mb-2">{f.title}</div>
                <div className="text-[13px] text-gray-500 leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT STRIP ────────────────────────── */}
      <section className="py-20 px-5 bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f4dd4] text-white">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-white/50 mb-3">About Gopexly</div>
            <h2 className="font-display text-[32px] font-extrabold mb-4 leading-tight">
              Built by Africans,<br/>for African Investors
            </h2>
            <p className="text-white/65 text-[15px] leading-relaxed mb-6">
              We built Gopexly because investing in Nigerian stocks shouldn&apos;t require jumping between spreadsheets, WhatsApp groups, and multiple apps. One platform. Everything you need.
            </p>
            <a href="/about-us.html" className="inline-flex items-center gap-2 bg-white/10 border border-white/20 text-white font-bold text-[14px] px-5 py-3 rounded-xl hover:bg-white/20 transition-all">
              Read Our Story →
            </a>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: '🔒', title: 'Privacy First',     desc: 'Your ₦ value is never visible to anyone.' },
              { icon: '🚫', title: 'No Data Sales',     desc: 'We never sell your personal data.' },
              { icon: '🇳🇬', title: 'NGX Focused',      desc: 'Built around the Nigerian Exchange.' },
              { icon: '⚡', title: 'Always Improving',  desc: 'New features every month.' },
            ].map(v => (
              <div key={v.title} className="bg-white/8 border border-white/10 rounded-2xl p-4">
                <div className="text-2xl mb-2">{v.icon}</div>
                <div className="font-bold text-[13px] mb-1">{v.title}</div>
                <div className="text-white/50 text-[12px] leading-relaxed">{v.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────── */}
      <section className="py-20 px-5 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-display text-[32px] font-extrabold text-gray-900 mb-3">Get started in 2 minutes</h2>
          <p className="text-gray-500 mb-12 text-[15px]">No broker account needed. No minimum balance. Just sign up and start tracking.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: '1', title: 'Create your account', desc: 'Sign up free with just your name and email.' },
              { step: '2', title: 'Build your portfolio', desc: 'Add your NGX holdings and watch your P&L update live.' },
              { step: '3', title: 'Join the community', desc: 'Follow investors, share insights, and grow together.' },
            ].map(s => (
              <div key={s.step} className="bg-white rounded-2xl p-6 border border-gray-200">
                <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center font-display text-[18px] font-black mb-4 mx-auto">{s.step}</div>
                <div className="font-display text-[16px] font-bold text-gray-900 mb-2">{s.title}</div>
                <div className="text-[13px] text-gray-500 leading-relaxed">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────── */}
      <section className="py-20 px-5 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="font-display text-[32px] font-extrabold text-gray-900 mb-4">Ready to invest smarter?</h2>
          <p className="text-gray-500 mb-8 text-[15px]">Join a growing community of African investors already on Gopexly.</p>
          <button onClick={() => openModal('signup')} className="bg-primary text-white text-[15px] font-bold px-10 py-4 rounded-2xl hover:bg-primary-dark transition-all shadow-lg">
            Create Free Account →
          </button>
          <p className="text-[12px] text-gray-400 mt-3">No credit card · No minimum balance · Cancel anytime</p>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────── */}
      <footer className="border-t border-gray-200 py-10 px-5 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-6 mb-6">
            <div className="font-display text-[17px] font-bold text-gray-900 flex items-center gap-2">
              <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center text-white text-xs font-black">G</div>
              Gopexly
            </div>
            <div className="flex flex-wrap gap-6 text-[13px] text-gray-500">
              <a href="/about-us.html" className="hover:text-gray-900 transition-colors">About</a>
              <a href="/contact-us.html" className="hover:text-gray-900 transition-colors">Contact</a>
              <a href="/terms-of-service.html" className="hover:text-gray-900 transition-colors">Terms</a>
              <a href="/privacy-policy.html" className="hover:text-gray-900 transition-colors">Privacy</a>
            </div>
          </div>
          <div className="text-[12px] text-gray-400 text-center border-t border-gray-200 pt-5">
            © 2026 Gopexly Technologies Ltd · Nigeria · Not a licensed investment advisor · All investing involves risk
          </div>
        </div>
      </footer>

      {/* ── AUTH MODAL ─────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setModalOpen(false) }}>
          <div className="bg-white rounded-3xl w-full max-w-[420px] shadow-2xl overflow-hidden">
            <div className="flex border-b border-gray-200">
              <button onClick={() => { setMode('signin'); setError(''); setSignupDone(false) }}
                className={`flex-1 py-4 text-[13px] font-bold transition-all ${mode === 'signin' ? 'text-primary border-b-2 border-primary' : 'text-gray-500'}`}>
                Sign In
              </button>
              <button onClick={() => { setMode('signup'); setError(''); setSignupDone(false) }}
                className={`flex-1 py-4 text-[13px] font-bold transition-all ${mode === 'signup' ? 'text-primary border-b-2 border-primary' : 'text-gray-500'}`}>
                Create Account
              </button>
            </div>

            <div className="p-6">
              {signupDone ? (
                <div className="text-center py-4">
                  <div className="text-4xl mb-3">📧</div>
                  <div className="font-display text-[16px] font-extrabold mb-2">Check your email!</div>
                  <div className="text-[13px] text-gray-500 mb-4">
                    We sent a confirmation link to <strong>{suData.email}</strong>.
                  </div>
                  <button onClick={() => { setSignupDone(false); setMode('signin') }} className="text-[13px] font-bold text-primary">
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <>
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-[13px] font-medium px-4 py-3 rounded-xl mb-4">
                      {error}
                    </div>
                  )}

                  {/* SIGN IN */}
                  {mode === 'signin' && (
                    <form onSubmit={doSignIn} className="flex flex-col gap-4">
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
                        <input type="email" value={siEmail} onChange={e => setSiEmail(e.target.value)}
                          placeholder="you@example.com" required autoComplete="email"
                          className="w-full bg-gray-50 border-[1.5px] border-gray-200 text-gray-900 px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary focus:bg-white transition-all" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Password</label>
                        <input type="password" value={siPassword} onChange={e => setSiPassword(e.target.value)}
                          placeholder="Your password" required autoComplete="current-password"
                          className="w-full bg-gray-50 border-[1.5px] border-gray-200 text-gray-900 px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary focus:bg-white transition-all" />
                      </div>

                      {/* Remember Me */}
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <div className="relative">
                          <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} className="sr-only" />
                          <div className={`w-10 h-5 rounded-full transition-all ${rememberMe ? 'bg-primary' : 'bg-gray-200'}`} />
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${rememberMe ? 'left-[22px]' : 'left-0.5'}`} />
                        </div>
                        <span className="text-[13px] font-medium text-gray-600">Keep me signed in</span>
                      </label>

                      <button type="submit" disabled={loading}
                        className="w-full bg-primary text-white font-bold py-3 rounded-xl text-[14px] hover:bg-primary-dark transition-all disabled:opacity-50">
                        {loading ? 'Signing in...' : 'Sign in to Gopexly →'}
                      </button>
                      <p className="text-center text-[12px] text-gray-400">
                        Don&apos;t have an account?{' '}
                        <button type="button" onClick={() => setMode('signup')} className="text-primary font-semibold">Create one</button>
                      </p>
                    </form>
                  )}

                  {/* SIGN UP */}
                  {mode === 'signup' && (
                    <form onSubmit={doSignUp} className="flex flex-col gap-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">First Name</label>
                          <input value={suData.firstName} onChange={e => setSuData(p => ({ ...p, firstName: e.target.value }))}
                            placeholder="Adaeze" required autoComplete="given-name"
                            className="w-full bg-gray-50 border-[1.5px] border-gray-200 text-gray-900 px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary transition-all" />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Last Name</label>
                          <input value={suData.lastName} onChange={e => setSuData(p => ({ ...p, lastName: e.target.value }))}
                            placeholder="Obi" autoComplete="family-name"
                            className="w-full bg-gray-50 border-[1.5px] border-gray-200 text-gray-900 px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary transition-all" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                          Username <span className="text-primary normal-case font-medium">must be unique</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[13px] font-semibold">@</span>
                          <input value={suData.username} onChange={e => checkUsername(e.target.value)}
                            placeholder="adaeze_invests" autoComplete="username"
                            className={`w-full bg-gray-50 border-[1.5px] text-gray-900 pl-7 pr-8 py-2.5 rounded-xl text-[13px] outline-none transition-all focus:bg-white ${
                              unStatus === 'available' ? 'border-gain' : unStatus === 'taken' || unStatus === 'invalid' ? 'border-loss' : 'border-gray-200 focus:border-primary'}`} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[15px]">
                            {unStatus === 'checking' ? '⏳' : unStatus === 'available' ? '✓' : unStatus === 'taken' || unStatus === 'invalid' ? '✗' : ''}
                          </span>
                        </div>
                        {unMsg && <p className={`text-[11px] mt-1 ${unStatus === 'available' ? 'text-gain' : 'text-loss'}`}>{unMsg}</p>}
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Phone Number</label>
                        <input type="tel" value={suData.phone} onChange={e => setSuData(p => ({ ...p, phone: e.target.value }))}
                          placeholder="+234 800 000 0000" required autoComplete="tel"
                          className="w-full bg-gray-50 border-[1.5px] border-gray-200 text-gray-900 px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary transition-all" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
                        <input type="email" value={suData.email} onChange={e => setSuData(p => ({ ...p, email: e.target.value }))}
                          placeholder="you@example.com" required autoComplete="email"
                          className="w-full bg-gray-50 border-[1.5px] border-gray-200 text-gray-900 px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary transition-all" />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Password</label>
                        <input type="password" value={suData.password} onChange={e => setSuData(p => ({ ...p, password: e.target.value }))}
                          placeholder="Min. 8 characters" required minLength={8} autoComplete="new-password"
                          className="w-full bg-gray-50 border-[1.5px] border-gray-200 text-gray-900 px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary transition-all" />
                      </div>
                      <button type="submit" disabled={loading}
                        className="w-full bg-primary text-white font-bold py-3 rounded-xl text-[14px] hover:bg-primary-dark transition-all disabled:opacity-50 mt-1">
                        {loading ? 'Creating account...' : 'Create my account →'}
                      </button>
                      <p className="text-center text-[11px] text-gray-400">
                        By signing up you agree to our{' '}
                        <a href="/terms-of-service.html" className="text-primary">Terms</a> &amp;{' '}
                        <a href="/privacy-policy.html" className="text-primary">Privacy Policy</a>
                      </p>
                    </form>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}