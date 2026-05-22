import { useState, useMemo, useRef } from 'react'
import {
  Plus, Trash2, X, Check, ArrowUpRight, ArrowDownRight,
  Wallet, Upload, Edit2, Loader2, Calendar,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, Cell, LabelList,
} from 'recharts'
import { forecastPayments, groupByMonth, splitPaymentsByDate } from '../lib/payments'

const ACCOUNT_TYPES = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'brokerage', label: 'Brokerage' },
  { value: 'money_market', label: 'Money Market' },
  { value: 'credit', label: 'Credit' },
  { value: 'other', label: 'Other' },
]

const INCOME_CATEGORIES = ['Commission', 'Bonus', 'Trading', 'Other Income']
const EXPENSE_CATEGORIES = [
  'Housing', 'Food', 'Transport', 'Bills', 'Health', 'Personal', 'Investing', 'Other',
]

const fmt = (n) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n || 0)

function autoCategory(description, isIncome) {
  const d = (description || '').toLowerCase()
  if (isIncome) {
    if (d.includes('commission') || d.includes('perry')) return 'Commission'
    if (d.includes('bonus')) return 'Bonus'
    if (d.includes('webull') || d.includes('hyperliquid') || d.includes('schwab')) return 'Trading'
    return 'Other Income'
  }
  if (d.includes('rent') || d.includes('mortgage') || d.includes('hoa')) return 'Housing'
  if (d.includes('grocery') || d.includes('whole foods') || d.includes('heb') || d.includes('kroger') || d.includes('restaurant') || d.includes('uber eats') || d.includes('doordash')) return 'Food'
  if (d.includes('shell') || d.includes('exxon') || d.includes('chevron') || d.includes('uber') || d.includes('lyft') || d.includes('gas')) return 'Transport'
  if (d.includes('comcast') || d.includes('att') || d.includes('verizon') || d.includes('tmobile') || d.includes('electric') || d.includes('water')) return 'Bills'
  if (d.includes('cvs') || d.includes('walgreen') || d.includes('pharmacy') || d.includes('doctor') || d.includes('dentist')) return 'Health'
  if (d.includes('webull') || d.includes('schwab') || d.includes('coinbase') || d.includes('robinhood')) return 'Investing'
  return 'Other'
}

function parseChaseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return { transactions: [], error: 'CSV is empty' }
  const header = lines[0].toLowerCase()
  const transactions = []
  const isCardFormat = header.includes('transaction date') && header.includes('post date')
  const isCheckingFormat = header.includes('posting date') || header.includes('details')

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const fields = []
    let current = ''
    let inQuotes = false
    for (const char of line) {
      if (char === '"') inQuotes = !inQuotes
      else if (char === ',' && !inQuotes) { fields.push(current.trim()); current = '' }
      else current += char
    }
    fields.push(current.trim())

    let date, description, amount
    if (isCardFormat) {
      date = fields[0]; description = fields[2]; amount = parseFloat(fields[5])
    } else if (isCheckingFormat) {
      date = fields[1]; description = fields[2]; amount = parseFloat(fields[3])
    } else continue

    if (!date || isNaN(amount)) continue
    const parsed = new Date(date)
    if (isNaN(parsed.getTime())) continue
    const isoDate = parsed.toISOString().slice(0, 10)
    const isIncome = amount > 0
    transactions.push({
      type: isIncome ? 'income' : 'expense',
      amount: Math.abs(amount),
      description: (description || '').slice(0, 200),
      date: isoDate,
      category: autoCategory(description, isIncome),
    })
  }
  return { transactions, error: null }
}

export default function MoMoney({
  sales,
  accounts, addAccount, updateAccount, deleteAccount,
  transactions, addTransaction, deleteTransaction,
  goToSales,
}) {
  const [view, setView] = useState('income') // 'income' | 'accounts' | 'transactions'
  const [showAccountForm, setShowAccountForm] = useState(false)
  const [showTxnForm, setShowTxnForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editingAccountId, setEditingAccountId] = useState(null)
  const [accountForm, setAccountForm] = useState({ name: '', type: 'checking', balance: 0 })
  const [txnForm, setTxnForm] = useState({
    type: 'income', amount: '', category: 'Commission',
    description: '', date: new Date().toISOString().slice(0, 10),
  })

  // Net worth
  const netWorth = accounts.reduce((sum, a) => {
    const sign = a.type === 'credit' ? -1 : 1
    return sum + sign * Number(a.balance || 0)
  }, 0)

  // Payment forecast from sales
  const allPayments = useMemo(() => forecastPayments(sales), [sales])
  const { past, upcoming } = useMemo(
    () => splitPaymentsByDate(allPayments),
    [allPayments]
  )
  const monthlyGroups = useMemo(() => groupByMonth(allPayments), [allPayments])

  // Past = already paid (collected)
  // Upcoming = expected income
  const collectedTotal = past.reduce((sum, p) => sum + p.amount, 0)
  const upcomingTotal = upcoming.reduce((sum, p) => sum + p.amount, 0)

  // Chart data — Jan of current year through Dec next year (covers past collected + future forecast)
  const chartData = useMemo(() => {
    const now = new Date()
    const startYear = now.getFullYear()
    const months = []
    // 24 months: Jan current year through Dec next year
    for (let i = 0; i < 24; i++) {
      const d = new Date(startYear, i, 1)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const bucket = monthlyGroups.find((m) => `${m.year}-${m.month}` === key)
      months.push({
        label: d.toLocaleString('en', { month: 'short' }),
        year: d.getFullYear(),
        month: d.getMonth(),
        amount: bucket?.total || 0,
        count: bucket?.payments.length || 0,
      })
    }
    // Trim trailing empty months so chart isn't full of zeros
    while (months.length > 12 && months[months.length - 1].amount === 0) {
      months.pop()
    }
    return months
  }, [monthlyGroups])

  // 6-month cash flow chart from real transactions + virtual commission income
  const cashFlow = useMemo(() => {
    const months = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: d.toLocaleString('en', { month: 'short' }),
        income: 0, expense: 0,
      })
    }
    transactions.forEach((t) => {
      const d = new Date(t.date)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const m = months.find((x) => x.key === key)
      if (m) {
        if (t.type === 'income') m.income += Number(t.amount)
        else m.expense += Number(t.amount)
      }
    })
    // Add virtual commission income (past payments only)
    past.forEach((p) => {
      const key = `${p.date.getFullYear()}-${p.date.getMonth()}`
      const m = months.find((x) => x.key === key)
      if (m) {
        // Dedupe — only add virtual if no matching real transaction exists
        const realMatch = transactions.find((t) =>
          t.type === 'income' &&
          Math.abs(Number(t.amount) - p.amount) < 1 &&
          Math.abs(new Date(t.date) - p.date) < 7 * 24 * 60 * 60 * 1000
        )
        if (!realMatch) m.income += p.amount
      }
    })
    return months
  }, [transactions, past])

  // Merged transaction list: real DB rows + virtual commission income from past payments
  // Dedupes if a real transaction already exists for the same payment
  const mergedTransactions = useMemo(() => {
    const realTxns = transactions.map((t) => ({ ...t, _virtual: false }))
    const virtualTxns = past
      .filter((p) => {
        // Only show virtual if no real transaction matches (amount within $1, date within 7 days)
        const match = transactions.find((t) =>
          t.type === 'income' &&
          Math.abs(Number(t.amount) - p.amount) < 1 &&
          Math.abs(new Date(t.date) - p.date) < 7 * 24 * 60 * 60 * 1000
        )
        return !match
      })
      .map((p) => ({
        id: `commission-${p.saleId}-${p.type}`,
        type: 'income',
        amount: p.amount,
        category: 'Commission',
        description: `${p.buyerName} — ${p.percent}% ${p.type}`,
        date: p.date.toISOString().slice(0, 10),
        _virtual: true,
      }))
    return [...realTxns, ...virtualTxns].sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [transactions, past])

  const openAddAccount = () => {
    setAccountForm({ name: '', type: 'checking', balance: 0 })
    setEditingAccountId(null)
    setShowAccountForm(true)
  }

  const openEditAccount = (a) => {
    setAccountForm({ name: a.name, type: a.type, balance: a.balance })
    setEditingAccountId(a.id)
    setShowAccountForm(true)
  }

  const handleAccountSubmit = async (e) => {
    e.preventDefault()
    const payload = { ...accountForm, balance: Number(accountForm.balance) || 0 }
    const { error } = editingAccountId
      ? await updateAccount(editingAccountId, payload)
      : await addAccount(payload)
    if (error) alert('Error: ' + error.message)
    else { setShowAccountForm(false); setEditingAccountId(null) }
  }

  const handleTxnSubmit = async (e) => {
    e.preventDefault()
    const { error } = await addTransaction({ ...txnForm, amount: Number(txnForm.amount) || 0 })
    if (error) alert('Error: ' + error.message)
    else {
      setShowTxnForm(false)
      setTxnForm({
        type: 'income', amount: '', category: 'Commission',
        description: '', date: new Date().toISOString().slice(0, 10),
      })
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-medium">MoMoney</h2>
        <p className="text-sm text-muted">Income forecast & accounts</p>
      </div>

      {/* View tabs */}
      <div className="bg-white border border-line rounded-xl p-1 grid grid-cols-3 gap-1">
        <button
          onClick={() => setView('income')}
          className={`px-3 py-2 rounded-lg text-xs font-medium transition ${
            view === 'income' ? 'bg-ink text-cream' : 'text-muted hover:bg-cream'
          }`}
        >
          Income
        </button>
        <button
          onClick={() => setView('accounts')}
          className={`px-3 py-2 rounded-lg text-xs font-medium transition ${
            view === 'accounts' ? 'bg-ink text-cream' : 'text-muted hover:bg-cream'
          }`}
        >
          Accounts
        </button>
        <button
          onClick={() => setView('transactions')}
          className={`px-3 py-2 rounded-lg text-xs font-medium transition ${
            view === 'transactions' ? 'bg-ink text-cream' : 'text-muted hover:bg-cream'
          }`}
        >
          Transactions
        </button>
      </div>

      {view === 'income' && (
        <>
          {/* Hero: Upcoming (primary), YTD Collected (secondary) */}
          <div className="bg-ink text-cream rounded-2xl p-6">
            <div className="text-xs uppercase tracking-widest text-gold mb-1">
              Upcoming Commission
            </div>
            <div className="font-display text-4xl md:text-5xl font-medium tracking-tight text-gold">
              {fmt(upcomingTotal)}
            </div>
            <div className="mt-4 pt-4 border-t border-cream/10 flex items-baseline justify-between flex-wrap gap-2">
              <div>
                <div className="text-[10px] text-cream/60 uppercase tracking-widest">YTD Collected</div>
                <div className="font-display text-xl font-medium">{fmt(collectedTotal)}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-cream/60 uppercase tracking-widest">Expected</div>
                <div className="text-sm font-medium">{upcoming.length} payment{upcoming.length !== 1 ? 's' : ''}</div>
              </div>
            </div>
          </div>

          {/* Forecast chart */}
          <div className="bg-white border border-line rounded-xl p-5">
            <div className="flex items-baseline justify-between mb-4">
              <h3 className="font-display text-base font-medium">Commission Timeline</h3>
              <span className="text-[10px] text-subtle uppercase tracking-wider">
                Perry pays 7th of month
              </span>
            </div>
            {allPayments.length === 0 ? (
              <div className="h-[220px] flex items-center justify-center text-xs text-subtle text-center px-6">
                Add sales to see your income forecast.<br />
                Perry pays 40% upfront month after contract, 60% month after closing.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 28, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#57534e' }} />
                  <YAxis
                    axisLine={false} tickLine={false}
                    tick={{ fontSize: 10, fill: '#a8a29e' }}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                  />
                  <Tooltip
                    cursor={{ fill: '#fefce8' }}
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null
                      const d = payload[0].payload
                      if (!d.amount) return null
                      return (
                        <div className="bg-ink text-cream px-3 py-2 rounded-lg shadow-lg text-xs">
                          <div className="font-medium">{d.label} {d.year}</div>
                          <div className="font-display text-base text-gold mt-0.5">{fmt(d.amount)}</div>
                          <div className="text-[10px] text-cream/60 mt-1">
                            {d.count} payment{d.count !== 1 ? 's' : ''} · click to view
                          </div>
                        </div>
                      )
                    }}
                  />
                  <Bar
                    dataKey="amount"
                    radius={[6, 6, 0, 0]}
                    cursor="pointer"
                    onClick={(data) => {
                      if (!data || !data.count || !goToSales) return
                      goToSales({ year: data.year, month: data.month })
                    }}
                  >
                    <LabelList
                      dataKey="amount"
                      position="top"
                      formatter={(v) => v > 0 ? (v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`) : ''}
                      style={{ fontSize: 10, fill: '#0a0a0f', fontWeight: 600 }}
                    />
                    {chartData.map((entry, idx) => {
                      const now = new Date()
                      const isFuture = (entry.year > now.getFullYear()) ||
                        (entry.year === now.getFullYear() && entry.month >= now.getMonth())
                      return <Cell key={idx} fill={isFuture ? '#d4af37' : '#a8a29e'} />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Payment schedule list */}
          {upcoming.length > 0 && (
            <div className="bg-white border border-line rounded-xl p-5">
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="font-display text-base font-medium">Expected Payments</h3>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-subtle">Total</div>
                  <div className="font-display text-lg font-medium text-green-700">{fmt(upcomingTotal)}</div>
                </div>
              </div>
              <div className="space-y-2">
                {upcoming.slice(0, 12).map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-cream rounded-lg">
                    <div className="w-10 h-10 rounded-lg bg-gold-soft text-gold-dark flex flex-col items-center justify-center shrink-0">
                      <div className="text-[8px] uppercase tracking-wider leading-none">{p.date.toLocaleString('en', { month: 'short' })}</div>
                      <div className="text-sm font-display font-medium leading-none mt-0.5">{p.date.getDate()}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.buyerName}</div>
                      <div className="text-[11px] text-subtle">
                        {p.percent}% {p.type === 'upfront' ? 'upfront' : 'closing'} · paid {p.date.toLocaleString('en', { month: 'long', year: 'numeric' })}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-display text-base font-medium text-green-700">
                        +{fmt(p.amount)}
                      </div>
                    </div>
                  </div>
                ))}
                {upcoming.length > 12 && (
                  <div className="text-center text-[11px] text-subtle py-2">
                    + {upcoming.length - 12} more payments
                  </div>
                )}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div className="bg-white border border-line rounded-xl p-5">
              <div className="flex items-baseline justify-between mb-1">
                <h3 className="font-display text-base font-medium">Collected</h3>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-subtle">Total</div>
                  <div className="font-display text-lg font-medium text-ink">{fmt(collectedTotal)}</div>
                </div>
              </div>
              <p className="text-xs text-muted mb-4">{past.length} payment{past.length !== 1 ? 's' : ''} based on contract/closing dates that have passed</p>
              <div className="space-y-2">
                {past.slice(-8).reverse().map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-cream/60 rounded-lg">
                    <div className="w-10 h-10 rounded-lg bg-green-50 text-green-700 flex flex-col items-center justify-center shrink-0">
                      <div className="text-[8px] uppercase tracking-wider leading-none">{p.date.toLocaleString('en', { month: 'short' })}</div>
                      <div className="text-sm font-display font-medium leading-none mt-0.5">{p.date.getDate()}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.buyerName}</div>
                      <div className="text-[11px] text-subtle">
                        {p.percent}% {p.type === 'upfront' ? 'upfront' : 'closing'} · paid {p.date.toLocaleString('en', { month: 'long', year: 'numeric' })}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-medium text-sm text-ink">
                        {fmt(p.amount)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {view === 'accounts' && (
        <>
          {/* Net worth hero */}
          <div className="bg-ink text-cream rounded-2xl p-6">
            <div className="text-xs uppercase tracking-widest text-gold mb-1">Net Worth</div>
            <div className="font-display text-4xl md:text-5xl font-medium tracking-tight">{fmt(netWorth)}</div>
            <div className="mt-3 text-xs text-cream/60">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</div>
          </div>

          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-medium">Accounts</h3>
            <button
              onClick={openAddAccount}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-ink text-cream rounded-lg text-xs font-medium hover:bg-ink/90 transition"
            >
              <Plus size={12} /> Add Account
            </button>
          </div>

          {accounts.length === 0 ? (
            <div className="bg-white border border-line rounded-xl p-10 text-center">
              <Wallet size={28} className="mx-auto text-subtle mb-3" />
              <p className="text-sm text-muted">No accounts yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((a) => (
                <div key={a.id} className="bg-white border border-line rounded-xl p-4 flex items-center justify-between hover:border-gold/40 transition">
                  <div>
                    <div className="font-medium text-sm">{a.name}</div>
                    <div className="text-xs text-subtle uppercase tracking-wider">
                      {ACCOUNT_TYPES.find((t) => t.value === a.type)?.label}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="font-display text-lg font-medium">
                      {a.type === 'credit' && '−'}{fmt(a.balance)}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEditAccount(a)} className="p-1.5 hover:bg-line rounded-lg transition">
                        <Edit2 size={13} className="text-muted" />
                      </button>
                      <button
                        onClick={() => { if (confirm('Delete this account?')) deleteAccount(a.id) }}
                        className="p-1.5 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 size={13} className="text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {view === 'transactions' && (
        <>
          {/* Cash flow chart */}
          <div className="bg-white border border-line rounded-xl p-5">
            <h3 className="font-display text-base font-medium mb-4">Cash Flow · Last 6 Months</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={cashFlow}>
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#57534e' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#a8a29e' }} tickFormatter={(v) => v >= 1000 ? `${v / 1000}k` : v} />
                <Tooltip
                  contentStyle={{ background: '#0a0a0f', border: 'none', borderRadius: 8, fontSize: 12, color: '#fafaf7' }}
                  formatter={(v) => fmt(v)}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="income" fill="#047857" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="#b91c1c" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-display text-base font-medium">{mergedTransactions.length} Transactions</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-line bg-white text-ink rounded-lg text-xs font-medium hover:bg-cream transition"
              >
                <Upload size={12} /> Import
              </button>
              <button
                onClick={() => setShowTxnForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-ink text-cream rounded-lg text-xs font-medium hover:bg-ink/90 transition"
              >
                <Plus size={12} /> Add
              </button>
            </div>
          </div>

          {mergedTransactions.length === 0 ? (
            <div className="bg-white border border-line rounded-xl p-10 text-center">
              <p className="text-sm text-muted">No transactions yet.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {mergedTransactions.map((t) => (
                <div key={t.id} className={`bg-white border rounded-xl p-3 flex items-center gap-3 hover:border-gold/40 transition ${t._virtual ? 'border-gold/30 bg-gold-soft/40' : 'border-line'}`}>
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      t.type === 'income' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {t.type === 'income' ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate flex items-center gap-1.5">
                      {t.description || t.category}
                      {t._virtual && (
                        <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium bg-gold text-ink">
                          Auto
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-subtle">
                      {t.category} · {new Date(t.date).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </div>
                  </div>
                  <div className={`font-medium text-sm ${t.type === 'income' ? 'text-green-700' : 'text-ink'}`}>
                    {t.type === 'income' ? '+' : '−'}{fmt(t.amount)}
                  </div>
                  {!t._virtual ? (
                    <button
                      onClick={() => { if (confirm('Delete this transaction?')) deleteTransaction(t.id) }}
                      className="p-1.5 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 size={13} className="text-red-600" />
                    </button>
                  ) : (
                    <div className="w-7" />
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showAccountForm && (
        <AccountFormModal
          form={accountForm} setForm={setAccountForm}
          editing={!!editingAccountId}
          onSubmit={handleAccountSubmit}
          onClose={() => setShowAccountForm(false)}
        />
      )}

      {showTxnForm && (
        <TxnFormModal
          form={txnForm} setForm={setTxnForm}
          onSubmit={handleTxnSubmit}
          onClose={() => setShowTxnForm(false)}
        />
      )}

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          addTransaction={addTransaction}
        />
      )}
    </div>
  )
}

function AccountFormModal({ form, setForm, editing, onSubmit, onClose }) {
  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-cream w-full md:max-w-md md:rounded-2xl rounded-t-2xl safe-bottom" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-line p-5 flex items-center justify-between">
          <h3 className="font-display text-xl font-medium">{editing ? 'Edit Account' : 'New Account'}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-line rounded-lg transition"><X size={18} /></button>
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-4">
          <Field label="Account Name" required>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required
              className="w-full px-3 py-2.5 bg-white border border-line rounded-lg text-sm" />
          </Field>
          <Field label="Type">
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full px-3 py-2.5 bg-white border border-line rounded-lg text-sm">
              {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Balance">
            <input type="number" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} step="0.01"
              className="w-full px-3 py-2.5 bg-white border border-line rounded-lg text-sm" />
          </Field>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 border border-line rounded-lg text-sm font-medium hover:bg-white transition">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-3 bg-ink text-cream rounded-lg text-sm font-medium hover:bg-ink/90 transition flex items-center justify-center gap-1.5">
              <Check size={14} /> Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TxnFormModal({ form, setForm, onSubmit, onClose }) {
  const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const handleTypeChange = (type) => {
    setForm((f) => ({ ...f, type, category: type === 'income' ? 'Commission' : 'Housing' }))
  }
  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-cream w-full md:max-w-md md:rounded-2xl rounded-t-2xl safe-bottom" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-line p-5 flex items-center justify-between">
          <h3 className="font-display text-xl font-medium">New Transaction</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-line rounded-lg transition"><X size={18} /></button>
        </div>
        <form onSubmit={onSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => handleTypeChange('income')}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium transition border ${
                form.type === 'income' ? 'bg-green-700 text-white border-green-700' : 'bg-white text-muted border-line'
              }`}>Income</button>
            <button type="button" onClick={() => handleTypeChange('expense')}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium transition border ${
                form.type === 'expense' ? 'bg-red-700 text-white border-red-700' : 'bg-white text-muted border-line'
              }`}>Expense</button>
          </div>
          <Field label="Amount" required>
            <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required step="0.01"
              className="w-full px-3 py-2.5 bg-white border border-line rounded-lg text-sm" />
          </Field>
          <Field label="Category">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2.5 bg-white border border-line rounded-lg text-sm">
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Description">
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-3 py-2.5 bg-white border border-line rounded-lg text-sm" />
          </Field>
          <Field label="Date">
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full px-3 py-2.5 bg-white border border-line rounded-lg text-sm" />
          </Field>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 border border-line rounded-lg text-sm font-medium hover:bg-white transition">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-3 bg-ink text-cream rounded-lg text-sm font-medium hover:bg-ink/90 transition flex items-center justify-center gap-1.5">
              <Check size={14} /> Save
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ImportModal({ onClose, addTransaction }) {
  const [parsed, setParsed] = useState(null)
  const [error, setError] = useState(null)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const fileInput = useRef(null)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)

    if (file.name.toLowerCase().endsWith('.pdf')) {
      setError('PDF parsing not yet enabled. Use CSV from Chase (Activity → Download).')
      return
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Only CSV files supported.')
      return
    }

    try {
      const text = await file.text()
      const result = parseChaseCSV(text)
      if (result.error) setError(result.error)
      else if (result.transactions.length === 0) setError('No transactions found.')
      else setParsed(result.transactions)
    } catch (err) {
      setError('Could not read file: ' + err.message)
    }
  }

  const handleImport = async () => {
    if (!parsed || parsed.length === 0) return
    setImporting(true)
    setProgress({ done: 0, total: parsed.length })
    let imported = 0
    for (const txn of parsed) {
      const { error } = await addTransaction(txn)
      if (!error) imported++
      setProgress({ done: imported, total: parsed.length })
    }
    setImporting(false)
    alert(`Imported ${imported} of ${parsed.length} transactions.`)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-cream w-full md:max-w-lg md:rounded-2xl rounded-t-2xl safe-bottom max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-cream border-b border-line p-5 flex items-center justify-between z-10">
          <h3 className="font-display text-xl font-medium">Import Statement</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-line rounded-lg transition"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          {!parsed && (
            <>
              <div className="bg-gold-soft border border-gold/30 rounded-xl p-4">
                <div className="text-[10px] uppercase tracking-widest text-gold-dark font-medium mb-1.5">
                  Chase Bank · CSV
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Log into Chase → Account → Activity → Download. Pick CSV format. Works with checking & credit card.
                </p>
                <p className="text-xs text-muted leading-relaxed mt-2">
                  PDF support coming later. Use CSV for now.
                </p>
              </div>
              <input ref={fileInput} type="file" accept=".csv,.pdf" onChange={handleFile} className="hidden" />
              <button
                onClick={() => fileInput.current?.click()}
                className="w-full py-8 border-2 border-dashed border-line rounded-xl hover:border-gold transition flex flex-col items-center gap-2"
              >
                <Upload size={24} className="text-subtle" />
                <span className="text-sm font-medium">Choose CSV file</span>
                <span className="text-[11px] text-subtle">Chase format</span>
              </button>
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
              )}
            </>
          )}

          {parsed && (
            <>
              <div className="bg-gold-soft border border-gold/30 rounded-xl p-4">
                <div className="text-[10px] uppercase tracking-widest text-gold-dark font-medium mb-1.5">
                  Preview · {parsed.length} transactions
                </div>
                <p className="text-xs text-muted">Review below. Categories auto-detected. Edit individuals after import.</p>
              </div>
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {parsed.slice(0, 50).map((t, i) => (
                  <div key={i} className="bg-white border border-line rounded-lg p-2.5 flex items-center gap-2 text-xs">
                    <div className={`w-7 h-7 rounded flex items-center justify-center shrink-0 ${
                      t.type === 'income' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {t.type === 'income' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{t.description}</div>
                      <div className="text-[10px] text-subtle">{t.category} · {t.date}</div>
                    </div>
                    <div className={`font-medium ${t.type === 'income' ? 'text-green-700' : 'text-ink'}`}>
                      {t.type === 'income' ? '+' : '−'}{fmt(t.amount)}
                    </div>
                  </div>
                ))}
                {parsed.length > 50 && (
                  <div className="text-center text-[11px] text-subtle py-2">+ {parsed.length - 50} more</div>
                )}
              </div>
              {importing && (
                <div className="bg-gold-soft border border-gold/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-xs text-gold-dark font-medium mb-2">
                    <Loader2 size={14} className="animate-spin" />
                    Importing {progress.done} / {progress.total}…
                  </div>
                  <div className="h-1.5 bg-cream rounded-full overflow-hidden">
                    <div className="h-full bg-gold transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setParsed(null); setError(null) }}
                  disabled={importing}
                  className="flex-1 px-4 py-3 border border-line rounded-lg text-sm font-medium hover:bg-white transition disabled:opacity-50"
                >
                  Pick Different File
                </button>
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="flex-1 px-4 py-3 bg-ink text-cream rounded-lg text-sm font-medium hover:bg-ink/90 transition disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Check size={14} /> Import All
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-muted font-medium mb-1.5">
        {label} {required && <span className="text-gold-dark">*</span>}
      </label>
      {children}
    </div>
  )
}
