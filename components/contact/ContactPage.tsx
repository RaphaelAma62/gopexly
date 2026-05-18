'use client'

import { useState } from 'react'

const FAQS = [
  { q: 'How do I upgrade to Pro?',           a: 'Click the 👑 Upgrade button in the top navigation bar to see pricing and upgrade via Paystack.' },
  { q: 'Can I cancel Pro anytime?',          a: 'Yes. Go to Profile → Settings → Subscription. You keep Pro until the end of your billing period.' },
  { q: 'Is my portfolio value private?',     a: 'Always. Your portfolio naira values are never visible to any other user. Only your percentage return can be shared, and only when you choose to.' },
  { q: 'Does Gopexly give investment advice?', a: 'No. Gopexly is a financial information and social investing platform, not a licensed advisor. All content is for informational purposes only.' },
  { q: 'How do I delete my account?',        a: 'Go to Profile → Settings → Delete Account. This permanently deletes all your data and cannot be undone.' },
  { q: 'How accurate are NGX stock prices?', a: 'Prices are updated every 10 minutes during trading hours from the Nigerian Exchange Group (NGX).' },
]

export default function ContactPage() {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', email: '', username: '', subject: '', message: ''
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    try {
      const body = new FormData()
      body.append('access_key', process.env.NEXT_PUBLIC_WEB3FORMS_KEY || '')
      body.append('subject', `New Contact Form Submission — Gopexly: ${formData.subject}`)
      body.append('from_name', 'Gopexly Contact Form')
      body.append('redirect', 'false')
      body.append('botcheck', '')
      Object.entries(formData).forEach(([k, v]) => body.append(k, v))
      const res = await fetch('https://api.web3forms.com/submit', { method: 'POST', body })
      const json = await res.json()
      if (json.success) setSent(true)
      else alert('Something went wrong. Please try again.')
    } catch { alert('Something went wrong. Please try again.') }
    setSending(false)
  }

  return (
    <div className="min-h-screen bg-[#f4f6fb] pb-20">

      {/* ── HERO ─────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f4dd4] text-white px-5 py-14 text-center">
        <div className="max-w-[600px] mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-[12px] font-bold uppercase tracking-widest mb-5">
            Support
          </div>
          <h1 className="font-display text-[36px] md:text-[44px] font-black mb-4 leading-tight">
            Contact Us
          </h1>
          <p className="text-white/65 text-[16px] leading-relaxed">
            Have a question, issue, or feedback? Send us a message and our team will get back to you.
          </p>
        </div>
      </div>

      <div className="max-w-[860px] mx-auto px-5 py-8 grid grid-cols-1 md:grid-cols-[1fr_340px] gap-5">

        {/* ── FORM ─────────────────────────────────── */}
        <div className="bg-white border border-border rounded-3xl p-7 shadow-sm">
          <h2 className="font-display text-[20px] font-extrabold mb-1">Send us a message</h2>
          <p className="text-text-muted text-[14px] mb-6">We typically respond within 24 hours on business days.</p>

          {sent ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-[56px] mb-4">✅</div>
              <div className="font-display text-[20px] font-extrabold mb-2">Message received!</div>
              <p className="text-text-muted text-[14px]">Thank you for reaching out. We will get back to you shortly.</p>
              <button onClick={() => { setSent(false); setFormData({ first_name: '', last_name: '', email: '', username: '', subject: '', message: '' }) }}
                className="mt-6 text-primary font-semibold text-[14px] hover:underline">
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">First Name *</label>
                  <input value={formData.first_name} onChange={e => setFormData(p => ({ ...p, first_name: e.target.value }))}
                    placeholder="Adaeze" required
                    className="w-full bg-gray-50 border-2 border-border text-text px-3.5 py-2.5 rounded-xl text-[14px] outline-none focus:border-primary focus:bg-white transition-all" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Last Name *</label>
                  <input value={formData.last_name} onChange={e => setFormData(p => ({ ...p, last_name: e.target.value }))}
                    placeholder="Okonkwo" required
                    className="w-full bg-gray-50 border-2 border-border text-text px-3.5 py-2.5 rounded-xl text-[14px] outline-none focus:border-primary focus:bg-white transition-all" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Email Address *</label>
                <input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                  placeholder="you@example.com" required
                  className="w-full bg-gray-50 border-2 border-border text-text px-3.5 py-2.5 rounded-xl text-[14px] outline-none focus:border-primary focus:bg-white transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Your Gopexly Username</label>
                <input value={formData.username} onChange={e => setFormData(p => ({ ...p, username: e.target.value }))}
                  placeholder="@yourusername"
                  className="w-full bg-gray-50 border-2 border-border text-text px-3.5 py-2.5 rounded-xl text-[14px] outline-none focus:border-primary focus:bg-white transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Subject *</label>
                <select value={formData.subject} onChange={e => setFormData(p => ({ ...p, subject: e.target.value }))} required
                  className="w-full bg-gray-50 border-2 border-border text-text px-3.5 py-2.5 rounded-xl text-[14px] outline-none focus:border-primary focus:bg-white transition-all">
                  <option value="" disabled>Select a topic...</option>
                  <option>General Question</option>
                  <option>Account or Login Issue</option>
                  <option>Billing or Subscription</option>
                  <option>Report a User or Content</option>
                  <option>Privacy or Data Request</option>
                  <option>Bug Report</option>
                  <option>Feature Request</option>
                  <option>Partnership or Press</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Message *</label>
                <textarea value={formData.message} onChange={e => setFormData(p => ({ ...p, message: e.target.value }))}
                  placeholder="Describe your question or issue in as much detail as possible..." required rows={5}
                  className="w-full bg-gray-50 border-2 border-border text-text px-3.5 py-3 rounded-xl text-[14px] outline-none focus:border-primary focus:bg-white transition-all resize-none font-sans" />
              </div>
              <button type="submit" disabled={sending}
                className="w-full bg-primary text-white font-bold py-4 rounded-2xl text-[15px] hover:bg-primary-dark transition-all shadow-md disabled:opacity-50">
                {sending ? 'Sending...' : 'Send Message →'}
              </button>
              <p className="text-center text-[12px] text-text-muted">
                By submitting you agree to our <a href="/privacy-policy.html" className="text-primary">Privacy Policy</a>
              </p>
            </form>
          )}
        </div>

        {/* ── RIGHT SIDEBAR ─────────────────────────── */}
        <div className="flex flex-col gap-4">

          {/* Response times */}
          <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
            <div className="font-display text-[14px] font-extrabold mb-4">⏱ Response Times</div>
            {[
              { label: 'General Support',    time: 'Within 24 hours' },
              { label: 'Billing Issues',     time: 'Within 12 hours' },
              { label: 'Security Reports',   time: 'Within 4 hours' },
              { label: 'Privacy Requests',   time: '30 days (NDPR)' },
            ].map(r => (
              <div key={r.label} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                <span className="text-[13px] text-text-secondary">{r.label}</span>
                <span className="text-[12px] font-bold text-gain bg-gain-bg px-2.5 py-1 rounded-full">{r.time}</span>
              </div>
            ))}
          </div>

          {/* Quick links */}
          <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
            <div className="font-display text-[14px] font-extrabold mb-4">📋 Quick Links</div>
            {[
              { label: 'Privacy Policy',    href: '/privacy-policy.html' },
              { label: 'Terms of Service',  href: '/terms-of-service.html' },
              { label: 'About Gopexly',     href: '/about' },
              { label: 'Upgrade to Pro',    href: '/pro' },
            ].map(l => (
              <a key={l.label} href={l.href}
                className="flex items-center justify-between py-2.5 border-b border-border last:border-0 text-[13px] font-medium text-text-secondary hover:text-primary transition-colors">
                {l.label} <span className="text-text-muted">→</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ── FAQ ──────────────────────────────────── */}
      <div className="max-w-[860px] mx-auto px-5">
        <div className="bg-white border border-border rounded-3xl p-7 shadow-sm">
          <h2 className="font-display text-[20px] font-extrabold mb-6">Frequently Asked Questions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-border rounded-2xl overflow-hidden">
            {FAQS.map(f => (
              <div key={f.q} className="bg-white p-5">
                <div className="font-bold text-[14px] mb-2">{f.q}</div>
                <div className="text-[13px] text-text-secondary leading-relaxed">{f.a}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
