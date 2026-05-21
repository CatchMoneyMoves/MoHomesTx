import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useSales(user) {
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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
