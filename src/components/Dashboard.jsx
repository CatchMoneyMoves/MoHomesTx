import { useMemo, useState, useEffect } from 'react'
import {
  TrendingUp, Home, DollarSign,
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

// Unit credit for a sale — weighted by split % (e.g. 80% split = 0.8
// units). A busted deal fully zeroes out its unit credit regardless of
// bust % — the bust percentage only controls the dollar clawback amount,
// not how many units get removed.
function unitsForSale(sale) {
  if (sale.status === 'busted') return 0
  return (Number(sale.split) || 100) / 100
}

const fmtUnits = (n) => {
  // Show whole numbers cleanly, fractional counts to 1 decimal
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

const QUARTER_MONTHS = {
  Q1: [0, 1, 2], Q2: [3, 4, 5], Q3: [6, 7, 8], Q4: [9, 10, 11],
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const STATUS_COLORS = {
  under_contract: { color: 'rgb(var(--st-blue-fg))', bg: 'rgb(var(--st-blue-bg))' },
  closed: { color: 'rgb(var(--st-green-fg))', bg: 'rgb(var(--st-green-bg))' },
  cancelled: { color: 'rgb(var(--st-red-fg))', bg: 'rgb(var(--st-red-bg))' },
  busted: { color: 'rgb(var(--st-red-fg))', bg: 'rgb(var(--st-red-bg))' },
  // Legacy fallbacks
  pending_earnest: { color: 'rgb(var(--st-blue-fg))', bg: 'rgb(var(--st-blue-bg))' },
  secured: { color: 'rgb(var(--st-blue-fg))', bg: 'rgb(var(--st-blue-bg))' },
  under_construction: { color: 'rgb(var(--st-blue-fg))', bg: 'rgb(var(--st-blue-bg))' },
  paid: { color: 'rgb(var(--st-green-fg))', bg: 'rgb(var(--st-green-bg))' },
}

const STATUS_LABELS = {
  under_contract: 'Under Contract', closed: 'Closed', cancelled: 'Cancelled',
  busted: 'Busted',
  pending_earnest: 'Under Contract', secured: 'Under Contract',
  under_construction: 'Under Contract', paid: 'Closed',
}

const PIPELINE_LABELS = {
  under_contract: 'Under Contract', closed: 'Closed',
  pending_earnest: 'Under Contract', secured: 'Under Contract',
  under_construction: 'Under Contract', paid: 'Closed',
  cancelled: 'Cancelled',
  busted: 'Busted',
}

export default function Dashboard({ sales, accounts, settings, setActiveTab, goToSales }) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [dateSource, setDateSource] = useState('contract_date')
  const [period, setPeriod] = useState(() => {
    try {
      return localStorage.getItem('mohomestx_dashboardPeriod') || 'monthly'
    } catch {
      return 'monthly'
    }
  })
  const [expandedQuarters, setExpandedQuarters] = useState({})
  const [expandedMonths, setExpandedMonths] = useState({})
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem('mohomestx_dashboardPeriod', period)
    } catch {}
  }, [period])

  // Track mobile viewport for compact axis labels (J F M A...)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

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
    const ytdUnits = yearSales.reduce((sum, s) => sum + unitsForSale(s), 0)

    const volumeGoal = Number(settings.annual_sales_volume_goal) || 10000000
    const volumePct = Math.min(100, (ytdVolume / volumeGoal) * 100)

    const quarters = {
      Q1: { sales: [], volume: 0, commission: 0, units: 0 },
      Q2: { sales: [], volume: 0, commission: 0, units: 0 },
      Q3: { sales: [], volume: 0, commission: 0, units: 0 },
      Q4: { sales: [], volume: 0, commission: 0, units: 0 },
    }
    const months = Array.from({ length: 12 }, (_, i) => ({
      idx: i,
      label: new Date(2000, i, 1).toLocaleString('en', { month: 'short' }),
      full: new Date(2000, i, 1).toLocaleString('en', { month: 'long' }),
      sales: [], volume: 0, commission: 0, units: 0,
    }))
    yearSales.forEach((s) => {
      const m = new Date(s[dateSource]).getMonth()
      const q = m < 3 ? 'Q1' : m < 6 ? 'Q2' : m < 9 ? 'Q3' : 'Q4'
      const u = unitsForSale(s)
      quarters[q].sales.push(s)
      quarters[q].volume += Number(s.sale_price || 0)
      quarters[q].commission += Number(s.commission_amount || 0)
      quarters[q].units += u
      months[m].sales.push(s)
      months[m].volume += Number(s.sale_price || 0)
      months[m].commission += Number(s.commission_amount || 0)
      months[m].units += u
    })

    const avgVolume = yearSales.length ? ytdVolume / yearSales.length : 0

    return {
      yearSales, ytdCommission, ytdVolume, ytdUnits,
      volumeGoal, volumePct,
      quarters, months, avgVolume,
    }
  }, [sales, settings, dateSource, year])

  const chartData = period === 'monthly'
    ? stats.months.map((m) => ({
        label: m.label,
        month: m.idx,
        value: m.volume,
        sales: m.sales.length,
      }))
    : ['Q1', 'Q2', 'Q3', 'Q4'].map((q) => ({
        label: q,
        quarter: q,
        value: stats.quarters[q].volume,
        sales: stats.quarters[q].sales.length,
      }))

  const toggleQuarter = (q) => setExpandedQuarters((p) => ({ ...p, [q]: !p[q] }))
  const toggleMonth = (k) => setExpandedMonths((p) => ({ ...p, [k]: !p[k] }))

  const handleBarClick = (data) => {
    if (period !== 'monthly') return
    if (!data || !data.sales || !goToSales) return
    goToSales({ year, month: data.month, mode: 'contract' })
  }

  // Weeks left in the year (auto-updates with system date)
  const weeksLeft = useMemo(() => {
    const now = new Date()
    const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59)
    const msLeft = endOfYear - now
    const weeks = Math.max(0, Math.ceil(msLeft / (7 * 24 * 60 * 60 * 1000)))
    return weeks
  }, [])

  // X-axis tick formatter — single letters on mobile monthly view, full label otherwise
  const formatXAxisTick = (value) => {
    if (isMobile && period === 'monthly') return value.charAt(0)
    return value
  }

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="font-display text-2xl font-medium">Dashboard</h2>
          <p className="text-sm text-muted">{fmtUnits(stats.ytdUnits)} {stats.ytdUnits === 1 ? 'unit' : 'units'} this year</p>
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

      <div className="bg-panel text-onpanel rounded-2xl p-6 md:p-8">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-xs tracking-widest text-gold uppercase">
            YTD Sales Volume
          </span>
          <span className="text-xs text-onpanel/60">{year} · {weeksLeft} {weeksLeft === 1 ? 'week' : 'weeks'} left</span>
        </div>
        <div className="font-display text-5xl md:text-6xl font-medium tracking-tight">
          {fmtCompact(stats.ytdVolume)}
        </div>
        <div className="mt-5">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs text-onpanel/60">
              Goal: {fmtCompact(stats.volumeGoal)}
            </span>
            <span className="text-xs font-medium text-gold">
              {stats.volumePct.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 bg-onpanel/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gold transition-all duration-500"
              style={{ width: `${stats.volumePct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard
          icon={<Home size={14} />}
          label="Units"
          value={fmtUnits(stats.ytdUnits)}
          suffix="YTD"
          onClick={() => setActiveTab && setActiveTab('sales')}
        />
        <KpiCard
          icon={<DollarSign size={14} />}
          label="Avg Price"
          value={fmtCompact(stats.avgVolume)}
        />
      </div>

      <div className="bg-white border border-line rounded-xl p-1 flex">
        <button
          onClick={() => setPeriod('monthly')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
            period === 'monthly' ? 'bg-panel text-onpanel' : 'text-muted hover:bg-cream'
          }`}
        >
          <Calendar size={12} /> Monthly
        </button>
        <button
          onClick={() => setPeriod('quarterly')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
            period === 'quarterly' ? 'bg-panel text-onpanel' : 'text-muted hover:bg-cream'
          }`}
        >
          <Calendar size={12} /> Quarterly
        </button>
      </div>

      <div className="bg-white border border-line rounded-xl p-5">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="font-display text-base font-medium">
            {period === 'monthly' ? 'Monthly' : 'Quarterly'} Sales Volume
          </h3>
          {period === 'monthly' && stats.yearSales.length > 0 && (
            <span className="text-[10px] text-subtle uppercase tracking-wider">
              Click a bar to view sales
            </span>
          )}
        </div>
        {stats.yearSales.length === 0 ? (
          <div className="h-[220px] flex items-center justify-center text-xs text-subtle">
            No sales for {year} yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 28, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }}
                interval={0}
                tickFormatter={formatXAxisTick}
              />
              <YAxis
                axisLine={false} tickLine={false}
                tick={{ fontSize: 10, fill: 'rgb(var(--subtle))' }}
                tickFormatter={(v) => {
                  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
                  if (v >= 1_000) return `${v / 1_000}k`
                  return v
                }}
              />
              <Tooltip
                cursor={{ fill: 'rgb(var(--gold-soft))' }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const d = payload[0].payload
                  if (!d.value) return null
                  return (
                    <div className="bg-panel text-onpanel px-3 py-2 rounded-lg shadow-lg text-xs">
                      <div className="font-medium">{d.label}</div>
                      <div className="font-display text-base text-gold mt-0.5">{fmt(d.value)}</div>
                      <div className="text-[10px] text-onpanel/60 mt-1">
                        {d.sales} {d.sales === 1 ? 'sale' : 'sales'}{period === 'monthly' ? ' · click to view' : ''}
                      </div>
                    </div>
                  )
                }}
              />
              <Bar
                dataKey="value"
                fill="rgb(var(--gold))"
                radius={[6, 6, 0, 0]}
                cursor={period === 'monthly' ? 'pointer' : 'default'}
                onClick={handleBarClick}
              >
                <LabelList
                  dataKey="value"
                  position="top"
                  formatter={(v) => {
                    if (!v || v <= 0) return ''
                    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
                    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}k`
                    return `$${v.toFixed(0)}`
                  }}
                  style={{ fontSize: period === 'monthly' ? 9 : 11, fill: 'rgb(var(--ink))', fontWeight: 600 }}
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
                        {fmtUnits(m.units)} {m.units === 1 ? 'unit' : 'units'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg font-medium text-ink">
                      {fmtCompact(m.volume)}
                    </div>
                    <div className="text-[10px] text-subtle uppercase tracking-wider">
                      {fmt(m.commission)} comm
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
                      {fmtUnits(data.units)} {data.units === 1 ? 'unit' : 'units'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-lg font-medium text-ink">
                    {fmtCompact(data.volume)}
                  </div>
                  {data.sales.length > 0 && (
                    <div className="text-[10px] text-subtle uppercase tracking-wider">
                      {fmt(data.commission)} comm
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
                      const monthValue = monthSales.reduce((sum, s) => sum + Number(s.sale_price || 0), 0)

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
                              {fmtCompact(monthValue)}
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
