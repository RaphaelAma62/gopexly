'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { validateUsername } from '@/lib/utils'

// ── TYPES ─────────────────────────────────────
type AuthMode = 'signin' | 'signup'

interface SignUpData {
  firstName: string
  lastName: string
  username: string
  phone: string
  email: string
  password: string
}

// ── USERNAME STATUS ───────────────────────────
type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

// ── MAIN PAGE ─────────────────────────────────
export default function LandingPage() {
  const router = useRouter()
  const sb = createClient()
  const [mode, setMode] = useState<AuthMode>('signin')
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Sign in fields
  const [siEmail, setSiEmail] = useState('')
  const [siPassword, setSiPassword] = useState('')

  // Sign up fields
  const [suData, setSuData] = useState<SignUpData>({
    firstName: '', lastName: '', username: '',
    phone: '', email: '', password: ''
  })
  const [unStatus, setUnStatus] = useState<UsernameStatus>('idle')
  const [unMsg, setUnMsg] = useState('')
  const unTimer = useRef<NodeJS.Timeout>()

  // Check if already logged in
  useEffect(() => {
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/home')
    })
  }, [sb, router])

  function openModal(m: AuthMode) {
    setMode(m)
    setModalOpen(true)
    setError('')
  }

  // ── USERNAME CHECK ──────────────────────────
  async function checkUsername(val: string) {
    const clean = val.toLowerCase().replace(/[^a-z0-9_]/g, '')
    setSuData(prev => ({ ...prev, username: clean }))

    clearTimeout(unTimer.current)
    const err = validateUsername(clean)
    if (!clean) { setUnStatus('idle'); setUnMsg(''); return }
    if (err) { setUnStatus('invalid'); setUnMsg(err); return }

    setUnStatus('checking')
    setUnMsg('Checking availability...')

    unTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/auth/check-username?username=${clean}`)
      const { available } = await res.json()
      setUnStatus(available ? 'available' : 'taken')
      setUnMsg(available ? `@${clean} is available!` : `@${clean} is already taken`)
    }, 500)
  }

  // ── SIGN IN ──────────────────────────────────
  async function doSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!siEmail || !siPassword) { setError('Please enter your email and password.'); return }
    setLoading(true)
    const { data, error: authErr } = await sb.auth.signInWithPassword({
      email: siEmail, password: siPassword
    })
    if (authErr) { setError('Incorrect email or password.'); setLoading(false); return }
    // Load profile and store in sessionStorage
    const { data: profileData } = await sb.from('profiles').select('*').eq('id', data.user.id).single()
    const profile = profileData as { first_name?: string; name?: string; initials?: string; username?: string; role?: string } | null
    const fn = profile?.first_name || (profile?.name?.split(' ')[0]) || siEmail.split('@')[0]
    sessionStorage.setItem('gopexly_user', JSON.stringify({
      id: data.user.id, name: profile?.name || fn, firstName: fn,
      initials: profile?.initials || fn.charAt(0).toUpperCase(),
      username: profile?.username || '', email: siEmail, role: profile?.role || 'user'
    }))
    router.replace('/home')
  }

  // ── SIGN UP ──────────────────────────────────
  async function doSignUp(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const { firstName, lastName, username, phone, email, password } = suData
    if (!firstName) { setError('Please enter your first name.'); return }
    if (!username || username.length < 3) { setError('Please choose a username (min. 3 characters).'); return }
    if (unStatus !== 'available') { setError('That username is not available. Please choose another.'); return }
    if (!phone) { setError('Please enter your phone number.'); return }
    if (!email) { setError('Please enter your email address.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    setLoading(true)

    // Double-check username
    const checkRes = await fetch(`/api/auth/check-username?username=${username}`)
    const { available } = await checkRes.json()
    if (!available) { setError(`@${username} was just taken. Please choose another.`); setLoading(false); return }

    // Create auth account
    const { data, error: signUpErr } = await sb.auth.signUp({ email, password })
    if (signUpErr) { setError(signUpErr.message); setLoading(false); return }
    if (!data.user) { setError('Something went wrong. Please try again.'); setLoading(false); return }

    const fullName = `${firstName} ${lastName}`.trim()
    const initials = firstName[0].toUpperCase() + (lastName ? lastName[0].toUpperCase() : '')

    // Save profile
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from('profiles') as any).upsert({
      id: data.user.id, name: fullName, first_name: firstName,
      initials, username, phone, joined_at: new Date().toISOString()
    }, { onConflict: 'id' })

    sessionStorage.setItem('gopexly_user', JSON.stringify({
      id: data.user.id, name: fullName, firstName, initials, username, email, role: 'user'
    }))
    router.replace('/home')
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
          <div className="flex items-center gap-3">
            <button
              onClick={() => openModal('signin')}
              className="text-[13px] font-semibold text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg hover:bg-gray-100 transition-all"
            >
              Sign In
            </button>
            <button
              onClick={() => openModal('signup')}
              className="text-[13px] font-bold bg-primary text-white px-5 py-2.5 rounded-xl hover:bg-primary-dark transition-all shadow-sm hover:shadow-md"
            >
              Get Started →
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────── */}
      <section className="pt-[120px] pb-20 px-5 text-center relative overflow-hidden">
        {/* Blob background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -left-20 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -right-20 w-[400px] h-[400px] bg-purple/5 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary-light text-primary text-[12px] font-bold px-4 py-1.5 rounded-full mb-6 border border-primary-border">
            🇳🇬 Built for African Investors
          </div>
          <h1 className="font-display text-[48px] md:text-[64px] font-black text-gray-900 leading-tight tracking-tight mb-6">
            Africa&apos;s Social<br />
            <span className="text-primary">Investing Platform</span>
          </h1>
          <p className="text-[18px] text-gray-500 mb-10 leading-relaxed max-w-xl mx-auto">
            Track NGX stocks, share investment insights, and grow your wealth alongside a community of investors.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <button
              onClick={() => openModal('signup')}
              className="bg-primary text-white text-[15px] font-bold px-8 py-4 rounded-2xl hover:bg-primary-dark transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              Start Investing Free →
            </button>
            <button
              onClick={() => openModal('signin')}
              className="text-[15px] font-semibold text-gray-700 px-8 py-4 rounded-2xl border border-gray-200 hover:bg-gray-50 transition-all"
            >
              Sign In
            </button>
          </div>
          <p className="text-[12px] text-gray-400 mt-4">Free forever · No credit card required</p>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────── */}
      <section className="py-20 px-5 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-display text-[32px] font-extrabold text-center text-gray-900 mb-3">
            Everything you need to invest smarter
          </h2>
          <p className="text-center text-gray-500 mb-12 text-[15px]">Built specifically for the Nigerian Exchange and African markets</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: '📈', title: 'Live NGX Prices', desc: '124 stocks tracked in real-time from the Nigerian Exchange Group. Auto-refreshed every 10 minutes.' },
              { icon: '🤝', title: 'Social Feed', desc: 'Share insights, post portfolio wins, tag stocks, and follow top investors in your network.' },
              { icon: '💼', title: 'Portfolio Tracker', desc: 'Track your holdings, see live P&L, set wealth goals, and monitor your allocation.' },
              { icon: '📚', title: 'Learn & Earn', desc: 'Complete investing courses created by our team. Earn points and climb the leaderboard.' },
              { icon: '🔒', title: 'Privacy First', desc: 'Your portfolio ₦ value is always private. Only you can see it — not even admins.' },
              { icon: '📰', title: 'Market News', desc: 'Curated financial news from our editors, delivered straight into your feed.' },
            ].map(f => (
              <div key={f.title} className="bg-white rounded-2xl p-6 border border-gray-200 hover:border-primary-border hover:shadow-md transition-all">
                <div className="text-3xl mb-4">{f.icon}</div>
                <div className="font-display text-[15px] font-bold text-gray-900 mb-2">{f.title}</div>
                <div className="text-[13px] text-gray-500 leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────── */}
      <section className="py-20 px-5 text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="font-display text-[32px] font-extrabold text-gray-900 mb-4">
            Ready to start investing smarter?
          </h2>
          <p className="text-gray-500 mb-8 text-[15px]">Join thousands of African investors already on Gopexly.</p>
          <button
            onClick={() => openModal('signup')}
            className="bg-primary text-white text-[15px] font-bold px-10 py-4 rounded-2xl hover:bg-primary-dark transition-all shadow-lg hover:shadow-xl"
          >
            Create Free Account →
          </button>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────── */}
      <footer className="border-t border-gray-200 py-8 px-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="font-display text-[15px] font-bold text-gray-900 flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center text-white text-xs font-black">G</div>
            Gopexly
          </div>
          <div className="text-[12px] text-gray-400">© 2026 Gopexly. All rights reserved.</div>
          <div className="flex gap-5 text-[12px] text-gray-500">
            <a href="#" className="hover:text-gray-900">Terms</a>
            <a href="#" className="hover:text-gray-900">Privacy</a>
            <a href="#" className="hover:text-gray-900">Contact</a>
          </div>
        </div>
      </footer>

      {/* ── AUTH MODAL ──────────────────────────── */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false) }}
        >
          <div className="bg-white rounded-3xl w-full max-w-[420px] shadow-2xl overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => { setMode('signin'); setError('') }}
                className={`flex-1 py-4 text-[13px] font-bold transition-all ${mode === 'signin' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setMode('signup'); setError('') }}
                className={`flex-1 py-4 text-[13px] font-bold transition-all ${mode === 'signup' ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Create Account
              </button>
            </div>

            <div className="p-6">
              {/* Error */}
              {error && (
                <div className="bg-loss-bg border border-loss-border text-loss text-[13px] font-medium px-4 py-3 rounded-xl mb-4">
                  {error}
                </div>
              )}

              {/* ── SIGN IN FORM ─────────────────── */}
              {mode === 'signin' && (
                <form onSubmit={doSignIn} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
                    <input
                      type="email" value={siEmail} onChange={e => setSiEmail(e.target.value)}
                      placeholder="you@example.com" required
                      className="w-full bg-gray-50 border-[1.5px] border-gray-200 text-gray-900 px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Password</label>
                    <input
                      type="password" value={siPassword} onChange={e => setSiPassword(e.target.value)}
                      placeholder="Your password" required
                      className="w-full bg-gray-50 border-[1.5px] border-gray-200 text-gray-900 px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary focus:bg-white transition-all"
                    />
                  </div>
                  <button
                    type="submit" disabled={loading}
                    className="w-full bg-primary text-white font-bold py-3 rounded-xl text-[14px] hover:bg-primary-dark transition-all disabled:opacity-50 mt-1"
                  >
                    {loading ? 'Signing in...' : 'Sign in to Gopexly →'}
                  </button>
                  <p className="text-center text-[12px] text-gray-400">
                    Don&apos;t have an account?{' '}
                    <button type="button" onClick={() => setMode('signup')} className="text-primary font-semibold">
                      Create one
                    </button>
                  </p>
                </form>
              )}

              {/* ── SIGN UP FORM ─────────────────── */}
              {mode === 'signup' && (
                <form onSubmit={doSignUp} className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">First Name</label>
                      <input
                        value={suData.firstName} onChange={e => setSuData(p => ({ ...p, firstName: e.target.value }))}
                        placeholder="Adaeze" required
                        className="w-full bg-gray-50 border-[1.5px] border-gray-200 text-gray-900 px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Last Name</label>
                      <input
                        value={suData.lastName} onChange={e => setSuData(p => ({ ...p, lastName: e.target.value }))}
                        placeholder="Obi"
                        className="w-full bg-gray-50 border-[1.5px] border-gray-200 text-gray-900 px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary focus:bg-white transition-all"
                      />
                    </div>
                  </div>

                  {/* Username */}
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">
                      Username <span className="text-primary normal-case font-medium">must be unique</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[13px] font-semibold">@</span>
                      <input
                        value={suData.username} onChange={e => checkUsername(e.target.value)}
                        placeholder="adaeze_invests" autoComplete="off"
                        className={`w-full bg-gray-50 border-[1.5px] text-gray-900 pl-7 pr-8 py-2.5 rounded-xl text-[13px] outline-none transition-all ${
                          unStatus === 'available' ? 'border-gain focus:border-gain' :
                          unStatus === 'taken' || unStatus === 'invalid' ? 'border-loss focus:border-loss' :
                          'border-gray-200 focus:border-primary'
                        } focus:bg-white`}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[15px]">
                        {unStatus === 'checking' ? '⏳' : unStatus === 'available' ? '✓' : unStatus === 'taken' || unStatus === 'invalid' ? '✗' : ''}
                      </span>
                    </div>
                    {unMsg && (
                      <p className={`text-[11px] mt-1 ${unStatus === 'available' ? 'text-gain' : unStatus === 'taken' || unStatus === 'invalid' ? 'text-loss' : 'text-gray-400'}`}>
                        {unMsg}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Phone Number</label>
                    <input
                      type="tel" value={suData.phone} onChange={e => setSuData(p => ({ ...p, phone: e.target.value }))}
                      placeholder="+234 800 000 0000" required
                      className="w-full bg-gray-50 border-[1.5px] border-gray-200 text-gray-900 px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
                    <input
                      type="email" value={suData.email} onChange={e => setSuData(p => ({ ...p, email: e.target.value }))}
                      placeholder="you@example.com" required
                      className="w-full bg-gray-50 border-[1.5px] border-gray-200 text-gray-900 px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Password</label>
                    <input
                      type="password" value={suData.password} onChange={e => setSuData(p => ({ ...p, password: e.target.value }))}
                      placeholder="Min. 8 characters" required minLength={8}
                      className="w-full bg-gray-50 border-[1.5px] border-gray-200 text-gray-900 px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary focus:bg-white transition-all"
                    />
                  </div>

                  <button
                    type="submit" disabled={loading}
                    className="w-full bg-primary text-white font-bold py-3 rounded-xl text-[14px] hover:bg-primary-dark transition-all disabled:opacity-50 mt-1"
                  >
                    {loading ? 'Creating account...' : 'Create my account →'}
                  </button>

                  <p className="text-center text-[11px] text-gray-400">
                    By signing up you agree to our{' '}
                    <a href="#" className="text-primary">Terms</a> &amp;{' '}
                    <a href="#" className="text-primary">Privacy Policy</a>
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
