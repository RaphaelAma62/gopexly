'use client'

import Link from 'next/link'

const VALUES = [
  { icon: '🔒', title: 'Privacy First',      desc: 'Your portfolio naira value is always completely private. No other user — not even our admins — can ever see what you are worth. Only you.' },
  { icon: '🤝', title: 'Community Driven',   desc: 'The best investment insights come from real investors. Our social feed puts the wisdom of the community directly in your hands.' },
  { icon: '📚', title: 'Education First',    desc: 'We build confident, informed investors through courses, quizzes, and real-world portfolio tracking — not just noise and hot tips.' },
  { icon: '🇳🇬', title: 'Built for Nigeria', desc: 'Every feature is designed around the Nigerian Exchange and African markets. We are not an American app adapted for Nigeria — we are Nigerian first.' },
]

const FEATURES = [
  { icon: '📈', title: 'Live NGX Prices',   desc: '124 stocks updated every 10 minutes directly from the Nigerian Exchange Group.' },
  { icon: '💼', title: 'Portfolio Tracker', desc: 'Track your holdings and see live P&L. Your naira value is always private.' },
  { icon: '🤝', title: 'Social Feed',       desc: 'Share insights, tag stocks, follow top investors, react, comment, and bookmark.' },
  { icon: '🤖', title: 'Gopex AI',          desc: 'Your personal NGX investing assistant, powered by advanced AI.' },
  { icon: '📚', title: 'Learn & Earn',      desc: 'Complete investing courses. Earn points and climb the community leaderboard.' },
  { icon: '👑', title: 'Gopexly Pro',       desc: 'Screener, clubs, unlimited AI, messaging, verified badge, and more.' },
]

const PROMISES = [
  { icon: '🔒', title: 'Portfolio Privacy',   desc: 'Your ₦ value is never visible to anyone. Ever.' },
  { icon: '🚫', title: 'No Data Sales',       desc: 'We will never sell your personal data.' },
  { icon: '📢', title: 'Not Financial Advice', desc: 'We provide data and community, not regulated investment advice.' },
  { icon: '⚡', title: 'Always Improving',    desc: 'New features shipped every month based on community feedback.' },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#f4f6fb] pb-20">

      {/* ── HERO ─────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f4dd4] text-white px-5 py-16 text-center">
        <div className="max-w-[700px] mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-[12px] font-bold uppercase tracking-widest mb-5">
            🇳🇬 Made in Nigeria
          </div>
          <h1 className="font-display text-[36px] md:text-[48px] font-black leading-tight mb-4">
            Investing for Every<br/>African, Together
          </h1>
          <p className="text-white/65 text-[16px] leading-relaxed max-w-lg mx-auto mb-8">
            Gopexly is Africa&apos;s social investing platform — built to make the Nigerian Exchange accessible, transparent, and community-driven for every investor.
          </p>
          {/* Stat pills */}
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { num: '124+',  label: 'NGX Stocks' },
              { num: 'Free',  label: 'To Join' },
              { num: '100%',  label: 'Portfolio Privacy' },
              { num: 'Live',  label: 'Real-Time Prices' },
            ].map(s => (
              <div key={s.label} className="bg-white/10 border border-white/15 rounded-2xl px-5 py-3 text-center">
                <div className="font-display text-[22px] font-black">{s.num}</div>
                <div className="text-[10px] text-white/50 uppercase tracking-wide mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[860px] mx-auto px-5 py-10 flex flex-col gap-5">

        {/* ── MISSION ──────────────────────────────── */}
        <div className="bg-white border border-border rounded-3xl p-7 shadow-sm">
          <div className="text-[11px] font-bold text-primary uppercase tracking-widest mb-3">Our Mission</div>
          <h2 className="font-display text-[24px] font-extrabold mb-4 leading-snug">
            Democratising investing across Africa
          </h2>
          <p className="text-[15px] text-text-secondary leading-relaxed mb-4">
            We believe every African deserves the tools, knowledge, and community to build long-term wealth through investing. The Nigerian Exchange Group has over 124 listed companies representing the backbone of the Nigerian economy. Yet most Nigerians have never bought a single share — not because they don&apos;t want to, but because the tools were never built for them.
          </p>
          <p className="text-[15px] text-text-secondary leading-relaxed">
            Gopexly changes that. We combine real-time market data, a social investing community, and an AI assistant into one platform that is simple, trusted, and built for the African investor.
          </p>
        </div>

        {/* ── OUR STORY ────────────────────────────── */}
        <div className="bg-white border border-border rounded-3xl p-7 shadow-sm">
          <div className="text-[11px] font-bold text-primary uppercase tracking-widest mb-3">Our Story</div>
          <h2 className="font-display text-[24px] font-extrabold mb-4 leading-snug">
            Why we built Gopexly
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div>
              <p className="text-[15px] text-text-secondary leading-relaxed mb-4">
                It started with a simple question: why is it so hard for Nigerians to invest in Nigerian companies? The NGX has existed since 1960. Yet finding live prices, understanding what stocks to buy, and connecting with other investors required jumping between multiple apps, spreadsheets, and WhatsApp groups.
              </p>
              <p className="text-[15px] text-text-secondary leading-relaxed">
                We built Gopexly to be the one platform where Nigerian investors can track their portfolio, follow other investors, learn how to invest, and stay on top of the market. We launched with a simple belief: <strong className="text-text">investing is better together.</strong>
              </p>
            </div>
            <div className="bg-gradient-to-br from-[#0f172a] to-primary rounded-2xl p-6 text-white">
              <div className="text-[18px] font-bold leading-relaxed italic mb-4">
                &ldquo;We wanted to build the platform we wished existed when we started investing in Nigerian stocks. Something built for us, by us.&rdquo;
              </div>
              <div className="text-white/50 text-[13px] font-medium">— The Gopexly Team</div>
            </div>
          </div>
        </div>

        {/* ── VALUES ───────────────────────────────── */}
        <div className="bg-white border border-border rounded-3xl p-7 shadow-sm">
          <div className="text-[11px] font-bold text-primary uppercase tracking-widest mb-3">What We Stand For</div>
          <h2 className="font-display text-[24px] font-extrabold mb-6 leading-snug">Our values</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {VALUES.map(v => (
              <div key={v.title} className="bg-[#f4f6fb] border border-border rounded-2xl p-5 flex gap-4">
                <div className="w-11 h-11 rounded-xl bg-primary-light border border-primary-border flex items-center justify-center text-[22px] flex-shrink-0">
                  {v.icon}
                </div>
                <div>
                  <div className="font-bold text-[15px] mb-1">{v.title}</div>
                  <div className="text-[13px] text-text-secondary leading-relaxed">{v.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FEATURES ─────────────────────────────── */}
        <div className="bg-[#0f172a] border border-[#1e2d3d] rounded-3xl p-7 shadow-sm">
          <div className="text-[11px] font-bold text-white/40 uppercase tracking-widest mb-3">The Platform</div>
          <h2 className="font-display text-[24px] font-extrabold mb-2 text-white leading-snug">Everything in one place</h2>
          <p className="text-white/50 text-[14px] mb-6">Built specifically for the Nigerian Exchange and African investors</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <div className="text-[26px] mb-3">{f.icon}</div>
                <div className="font-bold text-[14px] text-white mb-1.5">{f.title}</div>
                <div className="text-[12px] text-white/50 leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── PROMISE ──────────────────────────────── */}
        <div className="bg-white border border-border rounded-3xl p-7 shadow-sm">
          <div className="text-[11px] font-bold text-primary uppercase tracking-widest mb-3">Our Promise</div>
          <h2 className="font-display text-[24px] font-extrabold mb-2 leading-snug">What you can always count on</h2>
          <p className="text-text-muted text-[14px] mb-6">These are commitments we make to every Gopexly user, forever.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PROMISES.map(p => (
              <div key={p.title} className="bg-primary-light border border-primary-border rounded-2xl p-4 text-center">
                <div className="text-[28px] mb-2">{p.icon}</div>
                <div className="font-bold text-[13px] text-primary mb-1">{p.title}</div>
                <div className="text-[12px] text-text-muted leading-relaxed">{p.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA ──────────────────────────────────── */}
        <div className="bg-gradient-to-br from-primary to-[#7c3aed] rounded-3xl p-8 text-white text-center">
          <div className="text-[36px] mb-4">🚀</div>
          <h2 className="font-display text-[24px] font-extrabold mb-2">Ready to invest smarter?</h2>
          <p className="text-white/70 text-[15px] mb-6">Join a growing community of African investors already on Gopexly. Free forever.</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/home" className="bg-white text-primary font-extrabold text-[14px] px-7 py-3.5 rounded-2xl hover:bg-white/90 hover:-translate-y-0.5 transition-all shadow-lg">
              Open App →
            </Link>
            <Link href="/contact" className="bg-white/15 border border-white/25 text-white font-bold text-[14px] px-7 py-3.5 rounded-2xl hover:bg-white/25 transition-all">
              Contact Us
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
