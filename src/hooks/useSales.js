import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

// Local YYYY-MM-DD for "today" (avoids UTC off-by-one near midnight)
function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function useSales(user) {
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const autoClosedThisSession = useRef(false)

  const fetchSales = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .order('contract_date', { ascending: false, nullsFirst: false })
    if (error) {
      setError(error)
    } else {
      setSales(data || [])
      setError(null)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchSales()
  }, [fetchSales])

  // Auto-close: any sale still "under_contract" whose closing date has been
  // reached or passed flips to "closed" and persists to Supabase. Runs once
  // per session after sales load.
  useEffect(() => {
    if (!user || loading || autoClosedThisSession.current) return
    const today = todayKey()
    const due = sales.filter(
      (s) =>
        s.status === 'under_contract' &&
        s.closing_date &&
        String(s.closing_date).slice(0, 10) <= today
    )
    if (!due.length) return
    autoClosedThisSession.current = true
    ;(async () => {
      const updated = []
      for (const s of due) {
        const { data, error } = await supabase
          .from('sales')
          .update({ status: 'closed' })
          .eq('id', s.id)
          .select()
          .single()
        if (!error && data) updated.push(data)
      }
      if (updated.length) {
        setSales((prev) =>
          prev.map((s) => {
            const u = updated.find((x) => x.id === s.id)
            return u || s
          })
        )
      }
    })()
  }, [sales, loading, user])

  const addSale = async (sale) => {
    const payload = { ...sale, user_id: user.id }
    // commission_amount is computed by the DB — strip if present
    delete payload.commission_amount
    delete payload.id
    delete payload.created_at
    delete payload.updated_at
    const { data, error } = await supabase
      .from('sales')
      .insert(payload)
      .select()
      .single()
    if (!error && data) setSales((prev) => [data, ...prev])
    return { data, error }
  }

  const updateSale = async (id, updates) => {
    const payload = { ...updates }
    delete payload.commission_amount
    delete payload.user_id
    delete payload.id
    delete payload.created_at
    delete payload.updated_at
    const { data, error } = await supabase
      .from('sales')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (!error && data) {
      setSales((prev) => prev.map((s) => (s.id === id ? data : s)))
    }
    return { data, error }
  }

  const deleteSale = async (id) => {
    const { error } = await supabase.from('sales').delete().eq('id', id)
    if (!error) setSales((prev) => prev.filter((s) => s.id !== id))
    return { error }
  }

  return { sales, loading, error, addSale, updateSale, deleteSale, refresh: fetchSales }
}
