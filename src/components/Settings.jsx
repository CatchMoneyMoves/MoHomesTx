import { useState, useEffect } from 'react'
import { LogOut, Save, Key } from 'lucide-react'
import { signOut } from '../lib/auth'
import { supabase } from '../lib/supabase'

export default function Settings({ settings, updateSettings, user }) {
  const [form, setForm] = useState(settings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Password change state
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' })
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordChanged, setPasswordChanged] = useState(false)
  const [passwordError, setPasswordError] = useState('')

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

  const handleChangePassword = async () => {
    setPasswordError('')

    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('Please fill in both password fields.')
      return
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }

    setPasswordSaving(true)
    const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword })
    setPasswordSaving(false)

    if (error) {
      setPasswordError(error.message)
    } else {
      setPasswordChanged(true)
      setPasswordForm({ newPassword: '', confirmPassword: '' })
      setTimeout(() => setPasswordChanged(false), 3000)
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
          className="w-full py-3 bg-panel text-onpanel rounded-lg text-sm font-medium hover:bg-panel/90 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
        >
          <Save size={14} />
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Settings'}
        </button>
      </form>

      {/* Change Password */}
      <div className="bg-white border border-line rounded-xl p-5 space-y-4">
        <div>
          <h3 className="font-display text-base font-medium">Change Password</h3>
          <p className="text-xs text-muted mt-0.5">Update the password used to sign in</p>
        </div>

        <Field label="New Password">
          <input
            type="password"
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
            placeholder="At least 6 characters"
            autoComplete="new-password"
            className="w-full px-3 py-2.5 bg-cream border border-line rounded-lg text-sm"
          />
        </Field>

        <Field label="Confirm New Password">
          <input
            type="password"
            value={passwordForm.confirmPassword}
            onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
            autoComplete="new-password"
            className="w-full px-3 py-2.5 bg-cream border border-line rounded-lg text-sm"
          />
        </Field>

        {passwordError && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            {passwordError}
          </div>
        )}

        <button
          type="button"
          onClick={handleChangePassword}
          disabled={passwordSaving}
          className="w-full py-3 bg-panel text-onpanel rounded-lg text-sm font-medium hover:bg-panel/90 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
        >
          <Key size={14} />
          {passwordSaving ? 'Updating…' : passwordChanged ? 'Password Updated ✓' : 'Update Password'}
        </button>
      </div>

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
        MoHomesTx
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
