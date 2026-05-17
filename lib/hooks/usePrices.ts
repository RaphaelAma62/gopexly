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
      .select('ticker,price,change_pct,company_name')

    if (data) {
      const map: PriceMap = {}
      data.forEach(s => {
        map[s.ticker] = {
          price: s.price ?? 0,
          change_pct: s.change_pct ?? 0,
          company_name: s.company_name ?? s.ticker,
        }
      })
      setPrices(map)
    }
    setLoading(false)
  }, [sb])

  useEffect(() => {
    fetchPrices()
    // Refresh every 10 minutes
    const interval = setInterval(fetchPrices, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchPrices])

  return { prices, loading, refetch: fetchPrices }
}
