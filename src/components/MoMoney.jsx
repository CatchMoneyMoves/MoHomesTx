\import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LabelList,
} from 'recharts'
import { CheckCircle2 } from 'lucide-react'
import { forecastPayments, groupByMonth, splitPaymentsByDate } from '../lib/payments'

const fmt = (n) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n || 0)

export default function MoMoney({
  sales,
  accounts, addAccount, updateAccount, deleteAccount,
  transactions, addTransaction, deleteTransaction,
  goToSales,
}) {
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

  // Group upcoming payments by month for cleaner section-by-section display
  const upcomingByMonth = useMemo(() => {
    const groups = {}
    upcoming.forEach((p) => {
      const key = `${p.date.getFullYear()}-${p.date.getMonth()}`
      if (!groups[key]) {
        groups[key] = {
          year: p.date.getFullYear(),
          month: p.date.getMonth(),
          label: p.date.toLocaleString('en', { month: 'long', year: 'numeric' }),
          payments: [],
          total: 0,
        }
      }
      groups[key].payments.push(p)
      groups[key].total += p.amount
    })
    return Object.values(groups).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return a.month - b.month
    })
  }, [upcoming])

  // Group collected (past) payments by month, most recent month first
  const pastByMonth = useMemo(() => {
    const groups = {}
    past.forEach((p) => {
      const key = `${p.date.getFullYear()}-${p.date.getMonth()}`
      if (!groups[key]) {
        groups[key] = {
          year: p.date.getFullYear(),
          month: p.date.getMonth(),
          label: p.date.toLocaleString('en', { month: 'long', year: 'numeric' }),
          payments: [],
          total: 0,
        }
      }
      groups[key].payments.push(p)
      groups[key].total += p.amount
    })
    return Object.values(groups).sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year
      return b.month - a.month
    })
  }, [past])

  // Chart data — Jan of current year through Dec next year (covers past collected + future forecast)
  const chartData = useMemo(() => {
    const now = new Date()
    const startYear = now.getFullYear()
    const months = []
    // 12 months: Jan through Dec of the current year
    for (let i = 0; i < 12; i++) {
      const d = new Date(startYear, i, 1)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const bucket = monthlyGroups.find((m) => `${m.year}-${m.month}` === key)
      months.push({
        label: d.getFullYear() === startYear
          ? d.toLocaleString('en', { month: 'short' })
          : `${d.toLocaleString('en', { month: 'short' })} '${String(d.getFullYear()).slice(2)}`,
        year: d.getFullYear(),
        month: d.getMonth(),
        amount: bucket?.total || 0,
        count: bucket?.payments.length || 0,
      })
    }
    return months
  }, [monthlyGroups])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-medium">MoMoney</h2>
        <p className="text-sm text-muted">Income forecast</p>
      </div>

      {/* Hero: Upcoming (primary), YTD Collected (secondary) */}
      <div className="bg-panel text-onpanel rounded-2xl p-6">
        <div className="text-xs uppercase tracking-widest text-gold mb-1">
          Upcoming Commission
        </div>
        <div className="font-display text-4xl md:text-5xl font-medium tracking-tight text-gold">
          {fmt(upcomingTotal)}
        </div>
        <div className="mt-4 pt-4 border-t border-onpanel/10 flex items-baseline justify-between flex-wrap gap-2">
          <div>
            <div className="text-[10px] text-onpanel/60 uppercase tracking-widest">YTD Collected</div>
            <div className="font-display text-xl font-medium">{fmt(collectedTotal)}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-onpanel/60 uppercase tracking-widest">Expected</div>
            <div className="text-sm font-medium">{upcoming.length} payment{upcoming.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>

      {/* Forecast chart */}
      <div className="bg-white border border-line rounded-xl p-5">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="font-display text-base font-medium">Commission Timeline</h3>
          <span className="text-[10px] text-subtle uppercase tracking-wider">
            Pays 22nd &amp; 7th
          </span>
        </div>
        {allPayments.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-xs text-subtle text-center px-6">
            Add sales to see your income forecast.<br />
            Perry pays 40% upfront month after contract, 60% month after closing.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-1 px-1 [scrollbar-width:thin]">
            <div style={{ width: "960px", minWidth: "100%" }}>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 28, right: 6, left: -12, bottom: 0 }} barCategoryGap="12%">
                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    tick={{ fontSize: 10, fill: 'rgb(var(--muted))' }}
                  />
                  <YAxis
                    width={22}
                    axisLine={false} tickLine={false}
                    tick={{ fontSize: 10, fill: 'rgb(var(--subtle))' }}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                  />
              <Tooltip
                cursor={{ fill: 'rgb(var(--gold-soft))' }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const d = payload[0].payload
                  if (!d.amount) return null
                  return (
                    <div className="bg-panel text-onpanel px-3 py-2 rounded-lg shadow-lg text-xs">
                      <div className="font-medium">{d.label} {d.year}</div>
                      <div className="font-display text-base text-gold mt-0.5">{fmt(d.amount)}</div>
                      <div className="text-[10px] text-onpanel/60 mt-1">
                        {d.count} payment{d.count !== 1 ? 's' : ''} · click to view
                      </div>
                    </div>
                  )
                }}
              />
              <Bar
                dataKey="amount"
                fill="rgb(var(--gold))"
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
                  style={{ fontSize: 10, fill: 'rgb(var(--ink))', fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Payment schedule list — grouped by month */}
      {upcoming.length > 0 && (
        <div className="bg-white border border-line rounded-xl p-5">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="font-display text-base font-medium">Expected Payments</h3>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-subtle">Total</div>
              <div className="font-display text-lg font-medium text-green-700">{fmt(upcomingTotal)}</div>
            </div>
          </div>
          <div className="space-y-5">
            {upcomingByMonth.map((group) => (
              <div key={`${group.year}-${group.month}`}>
                <div className="flex items-baseline justify-between mb-2 pb-2 border-b border-line">
                  <div className="text-xs uppercase tracking-widest text-gold-dark font-medium">
                    {group.label}
                  </div>
                  <div className="text-[11px] text-subtle">
                    {group.payments.length} {group.payments.length === 1 ? 'payment' : 'payments'} · <span className="font-medium text-ink">{fmt(group.total)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {group.payments.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-cream rounded-lg">
                      <div className="w-10 h-10 rounded-lg bg-gold-soft text-gold-dark flex flex-col items-center justify-center shrink-0">
                        <div className="text-[8px] uppercase tracking-wider leading-none">{p.date.toLocaleString('en', { month: 'short' })}</div>
                        <div className="text-sm font-display font-medium leading-none mt-0.5">{p.date.getDate()}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <div className="text-sm font-medium truncate">{p.buyerName}</div>
                          {(p.type === 'upfront' || p.status === 'closed') && (
                            <CheckCircle2 size={14} className="text-green-700 shrink-0" aria-label="Closed" />
                          )}
                        </div>
                        <div className="text-[11px] text-subtle">
                          {p.percent}% {p.type === 'upfront' ? 'upfront' : p.type === 'bust' ? 'clawback' : 'closing'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`font-display text-base font-medium ${p.amount < 0 ? 'text-red-700' : 'text-green-700'}`}>
                          {p.amount < 0 ? '-' : '+'}{fmt(Math.abs(p.amount))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
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
          <div className="space-y-5">
            {pastByMonth.map((group) => (
              <div key={`${group.year}-${group.month}`}>
                <div className="flex items-baseline justify-between mb-2 pb-2 border-b border-line">
                  <div className="text-xs uppercase tracking-widest text-gold-dark font-medium">
                    {group.label}
                  </div>
                  <div className="text-[11px] text-subtle">
                    {group.payments.length} {group.payments.length === 1 ? 'payment' : 'payments'} · <span className="font-medium text-ink">{fmt(group.total)}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {group.payments.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-cream/60 rounded-lg">
                      <div className="w-10 h-10 rounded-lg bg-green-50 text-green-700 flex flex-col items-center justify-center shrink-0">
                        <div className="text-[8px] uppercase tracking-wider leading-none">{p.date.toLocaleString('en', { month: 'short' })}</div>
                        <div className="text-sm font-display font-medium leading-none mt-0.5">{p.date.getDate()}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <div className="text-sm font-medium truncate">{p.buyerName}</div>
                          {(p.type === 'upfront' || p.status === 'closed') && (
                            <CheckCircle2 size={14} className="text-green-700 shrink-0" aria-label="Closed" />
                          )}
                        </div>
                        <div className="text-[11px] text-subtle">
                          {p.percent}% {p.type === 'upfront' ? 'upfront' : p.type === 'bust' ? 'clawback' : 'closing'} · paid {p.date.toLocaleString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`font-medium text-sm ${p.amount < 0 ? 'text-red-700' : 'text-ink'}`}>
                          {p.amount < 0 ? '-' : ''}{fmt(Math.abs(p.amount))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
