import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const DEFAULT_SETTINGS = {
  annual_goal: 180000,
  annual_sales_volume_goal: 10000000,
  default_commission_rate: 2.0,
  user_name: 'Mo',
}

export function useSettings(user) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  const fetchSettings = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Settings fetch error:', error)
    }

    if (data) {
      setSettings({
        annual_goal: Number(data.annual_goal) || DEFAULT_SETTINGS.annual_goal,
        annual_sales_volume_goal:
          Number(data.annual_sales_volume_goal) || DEFAULT_SETTINGS.annual_sales_volume_goal,
        default_commission_rate:
          Number(data.default_commission_rate) || DEFAULT_SETTINGS.default_commission_rate,
        user_name: data.user_name || DEFAULT_SETTINGS.user_name,
      })
    } else {
      // No settings row yet — create one (trigger should have, but fallback)
      await supabase.from('settings').insert({ user_id: user.id, ...DEFAULT_SETTINGS })
      setSettings(DEFAULT_SETTINGS)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const updateSettings = async (updates) => {
    const newSettings = { ...settings, ...updates }
    setSettings(newSettings)
    const { error } = await supabase
      .from('settings')
      .update(updates)
      .eq('user_id', user.id)
    return { error }
  }

  return { settings, loading, updateSettings }
}
