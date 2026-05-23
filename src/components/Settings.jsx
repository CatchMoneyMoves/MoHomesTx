import { useState, useEffect } from 'react'
import { LogOut, Save } from 'lucide-react'
import { signOut } from '../lib/auth'

export default function Settings({ settings, updateSettings, user }) {
  const [form, setForm] = useState(settings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setForm(settings)
  }, [settings])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    const { error } = await updateSettings({
      annual_goal: Number(form.annual_goal) || 180000,
      annual_sales_volume_goal: Number(form.annual_sales_volume_goal) || 10000000,
      default_commission_rate: Number(form.default_commission_rate) || 2.0,
      user_name: form.user_name || 'Mo',
    })
    setSaving(false)
    if (!error) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const handleSignOut = async () => {
    if (!confirm('Sign out?')) return
    await signOut()
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-medium">Settings</h2>
        <p className="text-sm text-muted">{user?.email}</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-line rounded-xl p-5 space-y-4">
        <Field label="Display Name">
          <input
            type="text"
            value={form.user_name || ''}
            onChange={(e) => setForm({ ...form, user_name: e.target.value })}
            className="w-full px-3 py-2.5 bg-cream border border-line rounded-lg text-sm"
          />
        </Field>

        <Field label="Annual Sales Volume Goal ($)" hint="Total home prices you aim to sell this year">
          <input
            type="number"
            value={form.annual_sales_volume_goal || ''}
            onChange={(e) => setForm({ ...form, annual_sales_volume_goal: e.target.value })}
            step="100000"
            placeholder="10000000"
            className="w-full px-3 py-2.5 bg-cream border border-line rounded-lg text-sm"
          />
        </Field>

        <Field label="Annual Commission Goal ($)" hint="Total commission you aim to earn this year">
          <input
            type="number"
            value={form.annual_goal || ''}
            onChange={(e) => setForm({ ...form, annual_goal: e.target.value })}
            step="1000"
            placeholder="180000"
            className="w-full px-3 py-2.5 bg-cream border border-line rounded-lg text-sm"
          />
        </Field>

        <Field label="Default Commission Rate %">
          <input
            type="number"
            value={form.default_commission_rate || ''}
            onChange={(e) => setForm({ ...form, default_commission_rate: e.target.value })}
            step="0.1"
            className="w-full px-3 py-2.5 bg-cream border border-line rounded-lg text-sm"
          />
        </Field>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-ink text-cream rounded-lg text-sm font-medium hover:bg-ink/90 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
        >
          <Save size={14} />
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Settings'}
        </button>
      </form>

      {/* Account actions */}
      <div className="bg-white border border-line rounded-xl p-5 space-y-3">
        <h3 className="font-display text-base font-medium">Account</h3>
        <button
          onClick={handleSignOut}
          className="w-full py-2.5 border border-red-300 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50 transition flex items-center justify-center gap-1.5"
        >
          <LogOut size={14} /> Sign Out
        </button>
      </div>

      <div className="text-center text-[10px] text-subtle tracking-widest uppercase pt-2">
        MoHomes Tracker · 🦁 Lion energy
      </div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-muted font-medium mb-1.5">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[10px] text-subtle mt-1">{hint}</p>
      )}
    </div>
  )
}
