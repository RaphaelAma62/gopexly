import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { email, firstName, lastName } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY!,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        email,
        attributes: {
          FIRSTNAME: firstName || '',
          LASTNAME:  lastName  || '',
        },
        listIds: [7], // 👈 replace with your actual number e.g. [12]
        updateEnabled: true,
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      console.error('Brevo error:', err)
      return NextResponse.json({ error: 'Brevo failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Brevo route error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}