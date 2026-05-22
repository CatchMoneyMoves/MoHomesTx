import { useMemo, useState } from 'react'
import {
  TrendingUp, Target, Home, DollarSign,
  ChevronDown, ChevronRight, Calendar, BarChart3,
} from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, ResponsiveContainer,
  Tooltip, CartesianGrid, PieChart, Pie, Cell, LabelList,
} from 'recharts'

const fmt = (n) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n || 0)

const fmtCompact = (n) => {
  if (!n) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`
  return `$${n}`
}

const QUARTER_MONTHS = {
  Q1: [0, 1, 2], Q2: [3, 4, 5], Q3: [6, 7, 8], Q4: [9, 10, 11],
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const STATUS_COLORS = {
  under_contract: { color: '#1d4ed8', bg: '#dbeafe' },
  closed: { color: '#047857', bg: '#d1fae5' },
  cancelled: { color: '#b91c1c', bg: '#fee2e2' },
  // Legacy fallbacks
  pending_earnest: { color: '#1d4ed8', bg: '#dbeafe' },
  secured: { color: '#1d4ed8', bg: '#dbeafe' },
  under_construction: { color: '#1d4ed8', bg: '#dbeafe' },
  paid: { color: '#047857', bg: '#d1fae5' },
}

const STATUS_LABELS = {
  under_contract: 'Under Contract', closed: 'Closed', cancelled: 'Cancelled',
  pending_earnest: 'Under Contract', secured: 'Under Contract',
  under_construction: 'Under Contract', paid: 'Closed',
}

const PIPELINE_LABELS = {
  under_contract: 'Under Contract', closed: 'Closed',
  pending_earnest: 'Under Contract', secured: 'Under Contract',
  under_construction: 'Under Contract', paid: 'Closed',
  cancelled: 'Cancelled',
}

export default function Dashboard({ sales, accounts, settings, setActiveTab }) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [dateSource, setDateSource] = useState('contract_date')
  const [period, setPeriod] = useState('monthly') // 'monthly' | 'quarterly'
  const [metric, setMetric] = useState('commission')
  const [expandedQuarters, setExpandedQuarters] = useState({})
  const [expandedMonths, setExpandedMonths] = useState({})

  const availableYears = useMemo(() => {
    const years = new Set()
    sales.forEach((s) => {
      const d = s[dateSource]
      if (d) years.add(new Date(d).getFullYear())
    })
    if (years.size === 0) years.add(new Date().getFullYear())
    return Array.from(years).sort((a, b) => b - a)
  }, [sales, dateSource])

  const stats = useMemo(() => {
    const yearSales = sales.filter((s) => {
      const d = s[dateSource]
      if (!d) return false
      return new Date(d).getFullYear() === year && s.status !== 'cancelled'
    })

    const ytdCommission = yearSales.reduce((sum, s) => sum + Number(s.commission_amount || 0), 0)
    const ytdVolume = yearSales.reduce((sum, s) => sum + Number(s.sale_price || 0), 0)

    const commissionGoal = Number(settings.annual_goal) || 180000
    const volumeGoal = Number(settings.annual_sales_volume_goal) || 10000000

    const commissionPct = Math.min(100, (ytdCommission / commissionGoal) * 100)
    const volumePct = Math.min(100, (ytdVolume / volumeGoal) * 100)

    const quarters = {
      Q1: { sales: [], commission: 0, volume: 0 },
      Q2: { sales: [], commission: 0, volume: 0 },
      Q3: { sales: [], commission: 0, volume: 0 },
      Q4: { sales: [], commission: 0, volume: 0 },
    }
    const months = Array.from({ length: 12 }, (_, i) => ({
      idx: i,
      label: new Date(2000, i, 1).toLocaleString('en', { month: 'short' }),
      full: new Date(2000, i, 1).toLocaleString('en', { month: 'long' }),
      sales: [], commission: 0, volume: 0,
    }))
    yearSales.forEach((s) => {
      const m = new Date(s[dateSource]).getMonth()
      const q = m < 3 ? 'Q1' : m < 6 ? 'Q2' : m < 9 ? 'Q3' : 'Q4'
      quarters[q].sales.push(s)
      quarters[q].commission += Number(s.commission_amount || 0)
      quarters[q].volume += Number(s.sale_price || 0)
      months[m].sales.push(s)
      months[m].commission += Number(s.commission_amount || 0)
      months[m].volume += Number(s.sale_price || 0)
    })

    const pipelineCounts = {}
    sales.forEach((s) => {
      if (s.status === 'cancelled') return
      // Normalize legacy statuses
      let key = s.status
      if (['pending_earnest', 'secured', 'under_construction'].includes(key)) key = 'under_contract'
      if (key === 'paid') key = 'closed'
      pipelineCounts[key] = (pipelineCounts[key] || 0) + 1
    })
    const pipeline = Object.entries(pipelineCounts).map(([status, count]) => ({
      name: PIPELINE_LABELS[status], value: count, status,
    }))

    const netWorth = accounts.reduce((sum, a) => {
      const sign = a.type === 'credit' ? -1 : 1
      return sum + sign * Number(a.balance || 0)
    }, 0)

    const avgCommission = yearSales.length ? ytdCommission / yearSales.length : 0
    const avgVolume = yearSales.length ? ytdVolume / yearSales.length : 0
    const monthNow = new Date().getMonth() + 1
    const commissionPace = monthNow > 0 ? (ytdCommission / monthNow) * 12 : 0
    const volumePace = monthNow > 0 ? (ytdVolume / monthNow) * 12 : 0

    return {
      yearSales, ytdCommission, ytdVolume,
      commissionGoal, volumeGoal, commissionPct, volumePct,
      quarters, months, pipeline, netWorth,
      avgCommission, avgVolume, commissionPace, volumePace,
    }
  }, [sales, accounts, settings, dateSource, year])

  const chartData = period === 'monthly'
    ? stats.months.map((m) => ({
        label: m.label,
        value: metric === 'commission' ? m.commission : m.volume,
        sales: m.sales.length,
      }))
    : ['Q1', 'Q2', 'Q3', 'Q4'].map((q) => ({
        label: q,
        value: metric === 'commission' ? stats.quarters[q].commission : stats.quarters[q].volume,
        sales: stats.quarters[q].sales.length,
      }))

  const heroValue = metric === 'commission' ? stats.ytdCommission : stats.ytdVolume
  const heroGoal = metric === 'commission' ? stats.commissionGoal : stats.volumeGoal
  const heroPct = metric === 'commission' ? stats.commissionPct : stats.volumePct
  const heroPace = metric === 'commission' ? stats.commissionPace : stats.volumePace
  const heroAvg = metric === 'commission' ? stats.avgCommission : stats.avgVolume

  const toggleQuarter = (q) => setExpandedQuarters((p) => ({ ...p, [q]: !p[q] }))
  const toggleMonth = (k) => setExpandedMonths((p) => ({ ...p, [k]: !p[k] }))

  // Weeks left in the year (auto-updates with system date)
  const weeksLeft = useMemo(() => {
    const now = new Date()
    const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
    const msLeft = endOfYear - now
    const weeks = Math.max(0, Math.ceil(msLeft / (7 * 24 * 60 * 60 * 1000)))
    return weeks
  }, [])

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="font-display text-2xl font-medium">Dashboard</h2>
          <p className="text-sm text-muted">{stats.yearSales.length} sales this year</p>
        </div>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="px-3 py-1.5 bg-white border border-line rounded-lg text-sm font-medium"
        >
          {availableYears.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-line rounded-xl p-1 flex">
        <button
          onClick={() => setMetric('commission')}
          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition ${
            metric === 'commission' ? 'bg-ink text-cream' : 'text-muted hover:bg-cream'
          }`}
        >
          Commission
        </button>
        <button
          onClick={() => setMetric('volume')}
          className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition ${
            metric === 'volume' ? 'bg-ink text-cream' : 'text-muted hover:bg-cream'
          }`}
        >
          Sales Volume
        </button>
      </div>

      <div className="bg-ink text-cream rounded-2xl p-6 md:p-8">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-xs tracking-widest text-gold uppercase">
            YTD {metric === 'volume' ? 'Sales Volume' : 'Commission'}
          </span>
          <span className="text-xs text-cream/60">{year} · {weeksLeft} {weeksLeft === 1 ? 'week' : 'weeks'} left</span>
        </div>
        <div className="font-display text-5xl md:text-6xl font-medium tracking-tight">
          {metric === 'volume' ? fmtCompact(heroValue) : fmt(heroValue)}
        </div>
        <div className="mt-5">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs text-cream/60">
              Goal: {metric === 'volume' ? fmtCompact(heroGoal) : fmt(heroGoal)}
            </span>
            <span className="text-xs font-medium text-gold">
              {heroPct.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 bg-cream/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gold transition-all duration-500"
              style={{ width: `${heroPct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <KpiCard
          icon={<Home size={14} />}
          label="Sales"
          value={stats.yearSales.length}
          suffix="YTD"
          onClick={() => setActiveTab && setActiveTab('sales')}
        />
        <KpiCard
          icon={<DollarSign size={14} />}
          label={metric === 'volume' ? 'Avg Price' : 'Avg Commission'}
          value={metric === 'volume' ? fmtCompact(heroAvg) : fmt(heroAvg)}
        />
        <KpiCard
          icon={<Target size={14} />}
          label="Net Worth"
          value={fmt(stats.netWorth)}
          onClick={() => setActiveTab && setActiveTab('momoney')}
        />
      </div>

      <div className="bg-white border border-line rounded-xl p-1 flex">
        <button
          onClick={() => setPeriod('monthly')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
            period === 'monthly' ? 'bg-ink text-cream' : 'text-muted hover:bg-cream'
          }`}
        >
          <Calendar size={12} /> Monthly
        </button>
        <button
          onClick={() => setPeriod('quarterly')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
            period === 'quarterly' ? 'bg-ink text-cream' : 'text-muted hover:bg-cream'
          }`}
        >
          <Calendar size={12} /> Quarterly
        </button>
      </div>

      <div className="bg-white border border-line rounded-xl p-5">
        <h3 className="font-display text-base font-medium mb-4">
          {period === 'monthly' ? 'Monthly' : 'Quarterly'} {metric === 'volume' ? 'Sales Volume' : 'Commission'}
        </h3>
        {stats.yearSales.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-xs text-subtle">
            No sales for {year} yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 28, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e0" vertical={false} />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#57534e' }} />
              <YAxis
                axisLine={false} tickLine={false}
                tick={{ fontSize: 10, fill: '#a8a29e' }}
                tickFormatter={(v) => {
                  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
                  if (v >= 1_000) return `${v / 1_000}k`
                  return v
                }}
              />
              <Tooltip
                cursor={{ fill: '#fefce8' }}
                contentStyle={{ background: '#0a0a0f', border: 'none', borderRadius: 8, fontSize: 12, color: '#fafaf7' }}
                formatter={(v) => fmt(v)}
              />
              <Bar dataKey="value" fill="#d4af37" radius={[6, 6, 0, 0]}>
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={(v) => {
                    if (!v || v <= 0) return ''
                    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
                    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`
                    return `$${v.toFixed(0)}`
                  }}
                  style={{ fontSize: period === 'monthly' ? 9 : 11, fill: '#0a0a0f', fontWeight: 600 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {period === 'monthly' ? (
        <div className="space-y-2">
          {stats.months.map((m) => {
            if (m.sales.length === 0) return null
            const monthKey = `M-${m.idx}`
            const isExpanded = expandedMonths[monthKey]
            const monthValue = metric === 'commission' ? m.commission : m.volume
            return (
              <div key={m.idx} className="bg-white border border-line rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleMonth(monthKey)}
                  className="w-full p-4 flex items-center justify-between hover:bg-cream transition"
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown size={16} className="text-muted" /> : <ChevronRight size={16} className="text-muted" />}
                    <div className="text-left">
                      <div className="font-display text-lg font-medium">{m.full}</div>
                      <div className="text-xs text-muted">
                        {m.sales.length} {m.sales.length === 1 ? 'sale' : 'sales'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg font-medium text-ink">
                      {metric === 'volume' ? fmtCompact(monthValue) : fmt(monthValue)}
                    </div>
                    <div className="text-[10px] text-subtle uppercase tracking-wider">
                      {metric === 'commission' ? `${fmtCompact(m.volume)} vol` : `${fmt(m.commission)} comm`}
                    </div>
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-line bg-cream/50 px-4 py-3 space-y-1.5">
                    {m.sales.map((sale) => {
                      const status = STATUS_COLORS[sale.status]
                      return (
                        <div key={sale.id} className="bg-white border border-line rounded-lg p-3 flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="font-medium text-sm truncate">{sale.buyer_name}</div>
                              <span
                                className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium"
                                style={{ background: status?.bg, color: status?.color }}
                              >
                                {STATUS_LABELS[sale.status]}
                              </span>
                            </div>
                            <div className="text-[11px] text-subtle mt-0.5 flex items-center gap-2 flex-wrap">
                              {sale.plan_design && <span>{sale.plan_design}</span>}
                              <span>{fmt(sale.sale_price)}</span>
                              <span className="capitalize">{sale.build_type}</span>
                              <span>{new Date(sale[dateSource]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-display text-base font-medium">{fmt(sale.commission_amount)}</div>
                            <div className="text-[10px] text-subtle">{sale.commission_rate}% × {sale.split}%</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
      <div className="space-y-2">
        {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => {
          const data = stats.quarters[q]
          const isExpanded = expandedQuarters[q]
          const months = QUARTER_MONTHS[q]

          const byMonth = months.map((m) => ({
            month: m,
            sales: data.sales.filter((s) => new Date(s[dateSource]).getMonth() === m),
          }))

          const quarterValue = metric === 'commission' ? data.commission : data.volume

          return (
            <div key={q} className="bg-white border border-line rounded-xl overflow-hidden">
              <button
                onClick={() => toggleQuarter(q)}
                className="w-full p-4 flex items-center justify-between hover:bg-cream transition"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? <ChevronDown size={16} className="text-muted" /> : <ChevronRight size={16} className="text-muted" />}
                  <div className="text-left">
                    <div className="font-display text-lg font-medium">{q}</div>
                    <div className="text-xs text-muted">
                      {data.sales.length} {data.sales.length === 1 ? 'sale' : 'sales'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-lg font-medium text-ink">
                    {metric === 'volume' ? fmtCompact(quarterValue) : fmt(quarterValue)}
                  </div>
                  {data.sales.length > 0 && (
                    <div className="text-[10px] text-subtle uppercase tracking-wider">
                      {metric === 'commission' ? `${fmtCompact(data.volume)} vol` : `${fmt(data.commission)} comm`}
                    </div>
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-line bg-cream/50">
                  {data.sales.length === 0 ? (
                    <div className="p-6 text-center text-xs text-subtle">No sales in {q}</div>
                  ) : (
                    byMonth.map(({ month, sales: monthSales }) => {
                      if (monthSales.length === 0) return null
                      const monthKey = `${q}-${month}`
                      const monthExpanded = expandedMonths[monthKey]
                      const monthValue = metric === 'commission'
                        ? monthSales.reduce((sum, s) => sum + Number(s.commission_amount || 0), 0)
                        : monthSales.reduce((sum, s) => sum + Number(s.sale_price || 0), 0)

                      return (
                        <div key={month} className="border-b border-line last:border-b-0">
                          <button
                            onClick={() => toggleMonth(monthKey)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-white transition"
                          >
                            <div className="flex items-center gap-3 pl-5">
                              {monthExpanded ? <ChevronDown size={14} className="text-subtle" /> : <ChevronRight size={14} className="text-subtle" />}
                              <div className="text-left">
                                <div className="text-sm font-medium">{MONTH_NAMES[month]}</div>
                                <div className="text-[11px] text-subtle">
                                  {monthSales.length} {monthSales.length === 1 ? 'sale' : 'sales'}
                                </div>
                              </div>
                            </div>
                            <div className="text-sm font-medium text-ink">
                              {metric === 'volume' ? fmtCompact(monthValue) : fmt(monthValue)}
                            </div>
                          </button>

                          {monthExpanded && (
                            <div className="px-4 pb-3 space-y-1.5 pl-12">
                              {monthSales.map((sale) => {
                                const status = STATUS_COLORS[sale.status]
                                return (
                                  <div key={sale.id} className="bg-white border border-line rounded-lg p-3 flex items-center justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <div className="font-medium text-sm truncate">{sale.buyer_name}</div>
                                        <span
                                          className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium"
                                          style={{ background: status.bg, color: status.color }}
                                        >
                                          {STATUS_LABELS[sale.status]}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-subtle mt-0.5 flex items-center gap-2 flex-wrap">
                                        {sale.plan_design && <span>{sale.plan_design}</span>}
                                        <span>{fmt(sale.sale_price)}</span>
                                        <span className="capitalize">{sale.build_type}</span>
                                        <span>{new Date(sale[dateSource]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                      <div className="font-display text-base font-medium">{fmt(sale.commission_amount)}</div>
                                      <div className="text-[10px] text-subtle">{sale.commission_rate}% × {sale.split}%</div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
      )}
    </div>
  )
}

function KpiCard({ icon, label, value, suffix, onClick }) {
  const interactive = !!onClick
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-line rounded-xl p-4 ${interactive ? 'cursor-pointer hover:border-gold/40 hover:bg-gold-soft/30 transition' : ''}`}
    >
      <div className="flex items-center gap-1.5 text-subtle mb-2">
        {icon}
        <span className="text-[10px] uppercase tracking-wider">{label}</span>
      </div>
      <div className="font-display text-2xl font-medium text-ink leading-tight">{value}</div>
      {suffix && <div className="text-[10px] text-subtle uppercase tracking-wider mt-1">{suffix}</div>}
    </div>
  )
}
