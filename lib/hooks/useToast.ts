'use client'

import { useState, useCallback } from 'react'
import type { ToastType } from '@/types'

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: ToastType; visible: boolean }>({
    message: '',
    type: '',
    visible: false,
  })

  const showToast = useCallback((message: string, type: ToastType = '') => {
    setToast({ message, type, visible: true })
    setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3500)
  }, [])

  return { toast, showToast }
}
