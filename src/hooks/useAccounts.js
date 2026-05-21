import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useAccounts(user) {
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchAccounts = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase.from('accounts').select('*').order('created_at')
    setAccounts(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const addAccount = async (account) => {
    const payload = { ...account, user_id: user.id, last_updated: new Date().toISOString() }
    delete payload.id
    const { data, error } = await supabase
      .from('accounts')
      .insert(payload)
      .select()
      .single()
    if (!error && data) setAccounts((prev) => [...prev, data])
    return { data, error }
  }

  const updateAccount = async (id, updates) => {
    const payload = { ...updates, last_updated: new Date().toISOString() }
    delete payload.user_id
    delete payload.id
    const { data, error } = await supabase
      .from('accounts')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (!error && data) {
      setAccounts((prev) => prev.map((a) => (a.id === id ? data : a)))
    }
    return { data, error }
  }

  const deleteAccount = async (id) => {
    const { error } = await supabase.from('accounts').delete().eq('id', id)
    if (!error) setAccounts((prev) => prev.filter((a) => a.id !== id))
    return { error }
  }

  return { accounts, loading, addAccount, updateAccount, deleteAccount, refresh: fetchAccounts }
}
