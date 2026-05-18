'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { PriceMap } from '@/types'

export function usePrices() {
  const [prices, setPrices] = useState<PriceMap>({})
  const [loading, setLoading] = useState(true)
  const sb = createClient()

  const fetchPrices = useCallback(async () => {
    const { data } = await sb
      .from('stock_prices')
      .select('ticker,price,change_pct,change_amt,company_name,volume,market_cap,last_updated')

    if (data) {
      const map: PriceMap = {}
      data.forEach((s: {
        ticker: string
        price: number | null
        change_pct: number | null
        change_amt?: number | null
        company_name: string | null
        volume?: number | null
        market_cap?: number | null
        last_updated?: string | null
      }) => {
        map[s.ticker] = {
          price:        s.price ?? 0,
          change_pct:   s.change_pct ?? 0,
          change_amt:   s.change_amt ?? 0,
          company_name: s.company_name ?? s.ticker,
          volume:       s.volume ?? undefined,
          market_cap:   s.market_cap ?? undefined,
          last_updated: s.last_updated ?? undefined,
        }
      })
      setPrices(map)
    }
    setLoading(false)
  }, [sb])

  useEffect(() => {
    fetchPrices()
    const interval = setInterval(fetchPrices, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchPrices])

  return { prices, loading, refetch: fetchPrices }
}