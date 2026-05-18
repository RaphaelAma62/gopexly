'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from './useAuth'

export interface AppSettings {
  pro_enabled: boolean
  pro_monthly_price: number
  pro_annual_price: number
  pro_feature_watchlist: boolean
  pro_feature_alerts: boolean
  pro_feature_screener: boolean
  pro_feature_charts: boolean
  pro_feature_ai_unlimited: boolean
  pro_feature_reports: boolean
  pro_feature_clubs: boolean
  pro_feature_messaging: boolean
  pro_feature_leaderboard: boolean
  verification_enabled: boolean
  paystack_live_mode: boolean
  maintenance_mode: boolean
}

export interface ProStatus {
  isPro: boolean
  plan: string
  expiresAt: string | null
  settings: AppSettings
  loading: boolean
  refetch: () => Promise<void>
}

const DEFAULT_SETTINGS: AppSettings = {
  pro_enabled: false,
  pro_monthly_price: 2000,
  pro_annual_price: 18000,
  pro_feature_watchlist: true,
  pro_feature_alerts: true,
  pro_feature_screener: true,
  pro_feature_charts: true,
  pro_feature_ai_unlimited: true,
  pro_feature_reports: true,
  pro_feature_clubs: true,
  pro_feature_messaging: true,
  pro_feature_leaderboard: true,
  verification_enabled: true,
  paystack_live_mode: false,
  maintenance_mode: false,
}

export function useProStatus(): ProStatus {
  const sb = createClient()
  const { user } = useAuth()
  const [isPro, setIsPro] = useState(false)
  const [plan, setPlan] = useState('free')
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      // Load app settings (public)
      const { data: settingsData } = await sb.from('app_settings').select('key,value')
      if (settingsData) {
        const map: Record<string, string> = {}
        settingsData.forEach((s: { key: string; value: string }) => { map[s.key] = s.value })
        setSettings({
          pro_enabled:              map.pro_enabled === 'true',
          pro_monthly_price:        parseInt(map.pro_monthly_price || '2000'),
          pro_annual_price:         parseInt(map.pro_annual_price || '18000'),
          pro_feature_watchlist:    map.pro_feature_watchlist !== 'false',
          pro_feature_alerts:       map.pro_feature_alerts !== 'false',
          pro_feature_screener:     map.pro_feature_screener !== 'false',
          pro_feature_charts:       map.pro_feature_charts !== 'false',
          pro_feature_ai_unlimited: map.pro_feature_ai_unlimited !== 'false',
          pro_feature_reports:      map.pro_feature_reports !== 'false',
          pro_feature_clubs:        map.pro_feature_clubs !== 'false',
          pro_feature_messaging:    map.pro_feature_messaging !== 'false',
          pro_feature_leaderboard:  map.pro_feature_leaderboard !== 'false',
          verification_enabled:     map.verification_enabled !== 'false',
          paystack_live_mode:       map.paystack_live_mode === 'true',
          maintenance_mode:         map.maintenance_mode === 'true',
        })
      }

      // Load user pro status
      if (user) {
        const { data: profile } = await sb.from('profiles')
          .select('is_pro,pro_expires_at,pro_plan')
          .eq('id', user.id)
          .single()
        if (profile) {
          const proData = profile as { is_pro: boolean; pro_expires_at: string | null; pro_plan: string }
          const stillPro = proData.is_pro && (
            !proData.pro_expires_at || new Date(proData.pro_expires_at) > new Date()
          )
          setIsPro(stillPro)
          setPlan(proData.pro_plan || 'free')
          setExpiresAt(proData.pro_expires_at)
        }
      }
    } catch (e) {
      console.error('useProStatus error:', e)
    }
    setLoading(false)
  }, [sb, user])

  useEffect(() => { fetchData() }, [fetchData])

  return { isPro, plan, expiresAt, settings, loading, refetch: fetchData }
}
