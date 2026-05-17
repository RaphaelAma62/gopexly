import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { messages, portfolio, prices } = await request.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages required' }, { status: 400 })
    }

    if (!process.env.GROQ_API_KEY) {
      console.error('GROQ_API_KEY is not set')
      return NextResponse.json({ reply: 'AI is not configured yet. Please contact support.' })
    }

    // Build portfolio context
    let portfolioContext = 'The user has no holdings yet.'
    if (portfolio && portfolio.length > 0) {
      const holdings = portfolio.map((h: {
        ticker: string; shares: number; buy_price: number; company_name: string
      }) => {
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
        .filter(([, v]) => (v.change_pct ?? 0) > 0)
        .sort((a, b) => (b[1].change_pct ?? 0) - (a[1].change_pct ?? 0))
        .slice(0, 5)
        .map(([t, v]) => `${t}: ₦${v.price.toFixed(2)} (+${(v.change_pct ?? 0).toFixed(2)}%)`)
        .join(', ')
      const losers = priceList
        .filter(([, v]) => (v.change_pct ?? 0) < 0)
        .sort((a, b) => (a[1].change_pct ?? 0) - (b[1].change_pct ?? 0))
        .slice(0, 5)
        .map(([t, v]) => `${t}: ₦${v.price.toFixed(2)} (${(v.change_pct ?? 0).toFixed(2)}%)`)
        .join(', ')
      marketContext = `Top NGX gainers today: ${gainers || 'none'}. Top NGX losers today: ${losers || 'none'}.`
    }

    const systemPrompt = `You are Gopex AI — the intelligent investing assistant built into Gopexly, Africa's social investing platform for the Nigerian Exchange Group (NGX).

You help Nigerian investors make smarter decisions. You know about NGX stocks, portfolio management, Nigerian financial markets, and the Gopexly platform features.

CURRENT USER PORTFOLIO:
${portfolioContext}

CURRENT NGX MARKET DATA:
${marketContext}

RULES:
- Friendly, conversational tone like a knowledgeable friend
- Keep responses to 2 to 4 sentences unless more detail is requested
- Use Nigerian context: use ₦ not $, NGX not NYSE
- Reference the user's actual portfolio when relevant
- Never give a direct buy or sell recommendation — explain factors to consider
- Remind users that investing carries risk when discussing specific stocks
- If you do not know something, say so honestly`

    // Try models in order — use first one that works
    const models = [
      'llama-3.1-8b-instant',
      'llama3-8b-8192',
      'gemma2-9b-it',
      'mixtral-8x7b-32768',
    ]

    let lastError = ''

    for (const model of models) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages.slice(-10),
            ],
            max_tokens: 500,
            temperature: 0.7,
          }),
        })

        if (!response.ok) {
          const errText = await response.text()
          console.error(`Model ${model} failed:`, response.status, errText)
          lastError = errText
          continue // try next model
        }

        const data = await response.json()
        const reply = data.choices?.[0]?.message?.content

        if (!reply) {
          lastError = 'Empty response from model'
          continue
        }

        console.log(`Success with model: ${model}`)
        return NextResponse.json({ reply })

      } catch (modelError) {
        console.error(`Model ${model} threw:`, modelError)
        lastError = String(modelError)
        continue
      }
    }

    // All models failed
    console.error('All models failed. Last error:', lastError)
    return NextResponse.json({
      reply: 'I am having trouble connecting right now. Please try again in a moment.'
    })

  } catch (error) {
    console.error('AI route error:', error)
    return NextResponse.json({
      reply: 'Something went wrong on my end. Please try again.'
    })
  }
}