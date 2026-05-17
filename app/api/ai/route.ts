import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { messages, portfolio, prices } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages required' }, { status: 400 })
    }

    // Build portfolio context
    let portfolioContext = 'The user has no holdings yet.'
    if (portfolio && portfolio.length > 0) {
      const holdings = portfolio.map((h: { ticker: string; shares: number; buy_price: number; company_name: string }) => {
        const currentPrice = prices?.[h.ticker]?.price ?? h.buy_price
        const value = h.shares * currentPrice
        const cost = h.shares * h.buy_price
        const pl = value - cost
        const plPct = cost > 0 ? ((pl / cost) * 100).toFixed(2) : '0'
        return `${h.ticker} (${h.company_name}): ${h.shares} shares, bought at ₦${h.buy_price}, now ₦${currentPrice.toFixed(2)}, P&L: ${pl >= 0 ? '+' : ''}₦${pl.toFixed(0)} (${plPct}%)`
      }).join('\n')
      portfolioContext = `The user currently holds:\n${holdings}`
    }

    // Build market context
    let marketContext = 'No market data available.'
    if (prices && Object.keys(prices).length > 0) {
      const priceList = Object.entries(prices) as [string, { price: number; change_pct: number; company_name: string }][]
      const gainers = priceList
        .filter(([, v]) => v.change_pct > 0)
        .sort((a, b) => b[1].change_pct - a[1].change_pct)
        .slice(0, 5)
        .map(([t, v]) => `${t}: ₦${v.price.toFixed(2)} (+${v.change_pct.toFixed(2)}%)`)
        .join(', ')
      const losers = priceList
        .filter(([, v]) => v.change_pct < 0)
        .sort((a, b) => a[1].change_pct - b[1].change_pct)
        .slice(0, 5)
        .map(([t, v]) => `${t}: ₦${v.price.toFixed(2)} (${v.change_pct.toFixed(2)}%)`)
        .join(', ')
      marketContext = `Top NGX gainers today: ${gainers || 'none'}. Top NGX losers today: ${losers || 'none'}.`
    }

    const systemPrompt = `You are Gopex AI — the intelligent investing assistant built into Gopexly, Africa's social investing platform for the Nigerian Exchange Group (NGX).

You help Nigerian investors make smarter decisions. You know about:
- NGX stocks, companies, sectors, and market trends
- Portfolio management, diversification, and risk
- Nigerian financial markets, CBN policies, and economy
- Personal finance and wealth building in Nigeria
- How to use Gopexly (portfolio tracker, social feed, learn & earn, market page)

CURRENT USER PORTFOLIO:
${portfolioContext}

CURRENT NGX MARKET DATA:
${marketContext}

RULES:
- Friendly, conversational tone — like a knowledgeable friend
- Keep responses concise — 2 to 4 sentences unless detail is requested
- Use Nigerian context: ₦ not $, NGX not NYSE, naira not dollars
- Reference the user's actual portfolio when relevant
- Never give a direct "buy this" or "sell this" recommendation — explain factors to consider instead
- Always remind users investing carries risk when discussing specific stocks
- If you do not know something, say so honestly
- You can explain any Gopexly feature if asked`

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-10),
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Groq error:', err)
      return NextResponse.json({ error: 'AI unavailable' }, { status: 500 })
    }

    const data = await response.json()
    const reply = data.choices?.[0]?.message?.content || 'Sorry, I could not respond. Please try again.'
    return NextResponse.json({ reply })

  } catch (error) {
    console.error('AI route error:', error)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
