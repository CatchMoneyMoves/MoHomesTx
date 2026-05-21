import { useState } from 'react'
import { Mail, Lock, ArrowRight, Loader2 } from 'lucide-react'
import {
  signInWithPassword,
  signUpWithPassword,
  signInWithMagicLink,
} from '../lib/auth'

export default function Login() {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup' | 'magic'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (mode === 'signin') {
        const { error } = await signInWithPassword(email, password)
        if (error) throw error
      } else if (mode === 'signup') {
        const { error } = await signUpWithPassword(email, password)
        if (error) throw error
        setMessage('Check your email to confirm your account.')
      } else if (mode === 'magic') {
        const { error } = await signInWithMagicLink(email)
        if (error) throw error
        setMessage('Check your email for the sign-in link.')
      }
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-cream">
      <div className="w-full max-w-sm">
        {/* Logo + Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-ink mb-5">
            <span className="font-display text-4xl font-semibold text-gold leading-none -mt-1">M</span>
          </div>
          <h1 className="font-display text-3xl font-medium tracking-tight text-ink">
            MoHomes Tracker
          </h1>
          <p className="text-sm text-muted mt-1.5 tracking-wide">
            Discipline beats talent.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle" size={16} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email"
              required
              autoComplete="email"
              className="w-full pl-10 pr-3.5 py-3 bg-white border border-line rounded-lg text-sm placeholder:text-subtle"
            />
          </div>

          {mode !== 'magic' && (
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle" size={16} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="password"
                required
                minLength={6}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                className="w-full pl-10 pr-3.5 py-3 bg-white border border-line rounded-lg text-sm placeholder:text-subtle"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-ink text-cream rounded-lg text-sm font-medium tracking-wide flex items-center justify-center gap-2 hover:bg-ink/90 disabled:opacity-50 transition"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                {mode === 'signin' && 'Sign in'}
                {mode === 'signup' && 'Create account'}
                {mode === 'magic' && 'Send magic link'}
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* Feedback */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="mt-4 p-3 rounded-lg bg-gold-soft border border-gold/30 text-xs text-ink">
            {message}
          </div>
        )}

        {/* Mode switchers */}
        <div className="mt-8 text-center space-y-2">
          {mode === 'signin' && (
            <>
              <button
                type="button"
                onClick={() => { setMode('magic'); setError(null); setMessage(null) }}
                className="block w-full text-xs text-muted hover:text-ink transition"
              >
                Sign in with magic link instead
              </button>
              <button
                type="button"
                onClick={() => { setMode('signup'); setError(null); setMessage(null) }}
                className="block w-full text-xs text-muted hover:text-ink transition"
              >
                New here? <span className="text-gold-dark font-medium">Create account</span>
              </button>
            </>
          )}
          {mode === 'signup' && (
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(null); setMessage(null) }}
              className="block w-full text-xs text-muted hover:text-ink transition"
            >
              Already have an account? <span className="text-gold-dark font-medium">Sign in</span>
            </button>
          )}
          {mode === 'magic' && (
            <button
              type="button"
              onClick={() => { setMode('signin'); setError(null); setMessage(null) }}
              className="block w-full text-xs text-muted hover:text-ink transition"
            >
              Use password instead
            </button>
          )}
        </div>

        <div className="mt-10 text-center text-[10px] text-subtle tracking-wider uppercase">
          🦁 Lion energy
        </div>
      </div>
    </div>
  )
}
