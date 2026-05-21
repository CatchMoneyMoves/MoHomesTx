import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useTransactions(user) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchTransactions = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: false })
    setTransactions(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  const addTransaction = async (transaction) => {
    const payload = { ...transaction, user_id: user.id }
    delete payload.id
    const { data, error } = await supabase
      .from('transactions')
      .insert(payload)
      .select()
      .single()
    if (!error && data) setTransactions((prev) => [data, ...prev])
    return { data, error }
  }

  const deleteTransaction = async (id) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (!error) setTransactions((prev) => prev.filter((t) => t.id !== id))
    return { error }
  }

  return { transactions, loading, addTransaction, deleteTransaction, refresh: fetchTransactions }
}
