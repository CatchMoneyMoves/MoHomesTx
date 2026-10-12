import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react'
import { payDateFor } from '../lib/payments'

const STATUS_OPTIONS = [
  { value: 'under_contract', label: 'Under Contract', color: 'rgb(var(--st-blue-fg))', bg: 'rgb(var(--st-blue-bg))' },
  { value: 'closed', label: 'Closed', color: 'rgb(var(--st-green-fg))', bg: 'rgb(var(--st-green-bg))' },
  { value: 'busted', label: 'Busted', color: 'rgb(var(--st-red-fg))', bg: 'rgb(var(--st-red-bg))' },
]

// Base commission rate (%). Anything above this (e.g. the 0.5% on Dirt) is a
// bonus that pays entirely at close rather than splitting 40/60.
const BASE_RATE = 2

const fmt = (n) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n || 0)

const emptyForm = {
  buyer_name: '',
  address: '',
  plan_design: '',
  contract_date: new Date().toISOString().slice(0, 10),
  closing_date: '',
  status: 'under_contract',
  build_type: 'inventory',
  sale_price: '',
  commission_rate: 2.0,
  split: 100,
  realtor_name: '',
  lead_source: '',
  notes: '',
  bust_percent: null,
  bust_date: '',
}

export default function Sales({ sales, addSale, updateSale, deleteSale, defaultRate, salesFilter, clearFilter }) {
  const [showForm, setShowForm] = useState(false)
  const [showBustSection, setShowBustSection] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [collapsedMonths, setCollapsedMonths] = useState(() => {
    try {
      const saved = localStorage.getItem('mohomestx_collapsedMonths')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })
  const [sortOrder, setSortOrder] = useState(() => {
    try {
      return localStorage.getItem('mohomestx_sortOrder') || 'newest'
    } catch {
      return 'newest'
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('mohomestx_collapsedMonths', JSON.stringify(collapsedMonths))
    } catch {}
  }, [collapsedMonths])

  useEffect(() => {
    try {
      localStorage.setItem('mohomestx_sortOrder', sortOrder)
    } catch {}
  }, [sortOrder])

  const openAdd = () => {
    setForm({ ...emptyForm, commission_rate: defaultRate || 2.0 })
    setEditingId(null)
    setShowBustSection(false)
    setShowForm(true)
  }

  const openEdit = (sale) => {
    // Migrate legacy statuses to new schema
    let status = sale.status || 'under_contract'
    if (['pending_earnest', 'secured', 'under_construction'].includes(status)) status = 'under_contract'
    if (status === 'paid') status = 'closed'

    setForm({
      buyer_name: sale.buyer_name || '',
      address: sale.address || '',
      plan_design: sale.plan_design || '',
      contract_date: sale.contract_date || '',
      closing_date: sale.closing_date || '',
      status,
      build_type: sale.build_type || 'inventory',
      sale_price: sale.sale_price || '',
      commission_rate: sale.commission_rate || 2.0,
      split: sale.split || 100,
      realtor_name: sale.realtor_name || '',
      lead_source: sale.lead_source || '',
      notes: sale.notes || '',
      bust_percent: sale.bust_percent || null,
      bust_date: sale.bust_date || '',
    })
    setEditingId(sale.id)
    setShowBustSection(status === 'busted')
    setShowForm(true)
  }

  const handleBuildTypeChange = (type) => {
    setForm((f) => ({
      ...f,
      build_type: type,
      commission_rate: type === 'dirt' ? 2.5 : 2.0,
    }))
  }

  // Toggle a bust percentage. Clicking the same one again clears it and
  // reverts status back to under_contract.
  const handleBustToggle = (pct) => {
    setForm((f) => {
      const clearing = f.bust_percent === pct
      return {
        ...f,
        bust_percent: clearing ? null : pct,
        status: clearing ? 'under_contract' : 'busted',
        bust_date: clearing ? '' : (f.bust_date || new Date().toISOString().slice(0, 10)),
      }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      sale_price: Number(form.sale_price) || 0,
      commission_rate: Number(form.commission_rate) || 2.0,
      split: Number(form.split) || 100,
      closing_date: form.closing_date || null,
      bust_percent: form.status === 'busted' ? form.bust_percent : null,
      bust_date: form.status === 'busted' ? (form.bust_date || null) : null,
    }
    const { error } = editingId
      ? await updateSale(editingId, payload)
      : await addSale(payload)
    setSaving(false)
    if (error) {
      alert('Error: ' + error.message)
    } else {
      setShowForm(false)
      setEditingId(null)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this sale? This cannot be undone.')) return
    await deleteSale(id)
  }

  const salePriceNum = Number(form.sale_price) || 0
  const rateNum = Number(form.commission_rate) || 0
  const splitNum = Number(form.split) || 0

  // 20% referral split: your cut of the TOTAL deal commission, all upfront, $0 close.
  // Otherwise: full 40% upfront of base 2% (never reduced by split); close = (60% base + bonus) × split.
  const isReferral = splitNum <= 20
  const previewBaseRate = Math.min(rateNum, BASE_RATE)
  const previewBaseComm = salePriceNum * (previewBaseRate / 100)
  const previewBonus = salePriceNum * (Math.max(0, rateNum - BASE_RATE) / 100)
  const previewUpfront = isReferral
    ? salePriceNum * (rateNum / 100) * (splitNum / 100)
    : previewBaseComm * 0.4
  const previewAtClose = isReferral
    ? 0
    : (previewBaseComm * 0.6 + previewBonus) * (splitNum / 100)
  const previewCommission = previewUpfront + previewAtClose

  // Clawback preview: portion of BASE commission owed back on a bust.
  // 40% bust = full upfront share owed back. 20% bust = half that.
  const previewClawback = previewBaseComm * ((form.bust_percent || 0) / 100)

  // Filter mode: 'contract' (filter by contract_date) or 'payment' (filter by payment month, default)
  const isContractMode = salesFilter?.mode === 'contract'

  const filterMatchesSale = (sale) => {
    if (!salesFilter) return true

    // Contract mode: filter by contract_date in the specified month
    if (isContractMode) {
      if (!sale.contract_date) return false
      const cd = new Date(sale.contract_date)
      return cd.getFullYear() === salesFilter.year && cd.getMonth() === salesFilter.month
    }

    // Payment mode (default): match if a payment lands in filter month
    // Perry pays semi-monthly: 1st–15th → 22nd same month, 16th–end → 7th next month (see payDateFor)
    if (sale.contract_date) {
      const payMonth = payDateFor(String(sale.contract_date).slice(0, 10))
      if (payMonth && payMonth.getFullYear() === salesFilter.year && payMonth.getMonth() === salesFilter.month) {
        return true
      }
    }
    if (sale.closing_date) {
      const payMonth = payDateFor(String(sale.closing_date).slice(0, 10))
      if (payMonth && payMonth.getFullYear() === salesFilter.year && payMonth.getMonth() === salesFilter.month) {
        return true
      }
    }
    return false
  }

  const visibleSales = sales
    .filter((s) => s.status !== 'cancelled')
    .filter(filterMatchesSale)

  // Group sales into month sections by CONTRACT date. Sorted newest month
  // first; sales within a month sorted by contract date descending. Months
  // with no sales are skipped.
  const groupSalesByMonth = (list, order) => {
    const groups = new Map()
    list.forEach((sale) => {
      const dateStr = sale.contract_date
      if (!dateStr) {
        // Sales with no contract date bucket together at the end
        const key = 'undated'
        if (!groups.has(key)) {
          groups.set(key, { key, year: -1, month: -1, label: 'No date', sales: [], commission: 0, sortDate: 0 })
        }
        const g = groups.get(key)
        g.sales.push(sale)
        g.commission += saleNetAmount(sale)
        return
      }
      const d = new Date(dateStr)
      const year = d.getFullYear()
      const month = d.getMonth()
      const key = `${year}-${month}`
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          year,
          month,
          label: new Date(year, month, 1).toLocaleString('en', { month: 'long', year: 'numeric' }),
          sales: [],
          commission: 0,
          sortDate: new Date(year, month, 1).getTime(),
        })
      }
      const g = groups.get(key)
      g.sales.push(sale)
      g.commission += saleNetAmount(sale)
    })
    const arr = Array.from(groups.values())
    const dated = arr.filter((g) => g.key !== 'undated')
    const undated = arr.filter((g) => g.key === 'undated')
    // Sort dated sections by month; direction follows sortOrder. Undated
    // sales always stay last regardless of order.
    dated.sort((a, b) => (order === 'oldest' ? a.sortDate - b.sortDate : b.sortDate - a.sortDate))
    // Sort sales within each month by contract date; direction follows sortOrder.
    dated.forEach((g) => {
      g.sales.sort((a, b) => {
        const da = new Date(a.contract_date || 0).getTime()
        const db = new Date(b.contract_date || 0).getTime()
        return order === 'oldest' ? da - db : db - da
      })
    })
    return [...dated, ...undated]
  }

  // Compute the actual upfront/close amounts for a sale (bonus loads onto close)
  const saleSplitAmounts = (sale) => {
    const price = Number(sale.sale_price || 0)
    const rate = Number(sale.commission_rate || 0)
    const splitPct = Number(sale.split || 100)
    const split = splitPct / 100
    // 20% referral: full cut of total commission, all upfront, $0 at close.
    if (splitPct <= 20) {
      return { upfront: price * (rate / 100) * split, closing: 0 }
    }
    const baseComm = price * (Math.min(rate, BASE_RATE) / 100)
    const bonus = price * (Math.max(0, rate - BASE_RATE) / 100)
    // Upfront: full 40% of base (no split). Closing: (60% base + bonus) × split.
    return { upfront: baseComm * 0.4, closing: (baseComm * 0.6 + bonus) * split }
  }

  // Clawback amount owed back on a busted sale: portion of BASE commission
  // (40% bust = full upfront share, 20% bust = half that), shown as negative.
  const saleClawback = (sale) => {
    const price = Number(sale.sale_price || 0)
    const rate = Number(sale.commission_rate || 0)
    const baseComm = price * (Math.min(rate, BASE_RATE) / 100)
    return baseComm * ((Number(sale.bust_percent) || 0) / 100)
  }

  // Net commission contribution for a sale — negative clawback if busted,
  // otherwise the normal commission_amount.
  const saleNetAmount = (sale) => {
    if (sale.status === 'busted') return -saleClawback(sale)
    return Number(sale.commission_amount || 0)
  }

  const monthGroups = groupSalesByMonth(visibleSales, sortOrder)
  const toggleMonth = (key) => setCollapsedMonths((p) => ({ ...p, [key]: !p[key] }))

  // Only show payment-type badges in payment mode
  const paymentTypeForSale = (sale) => {
    if (!salesFilter || isContractMode) return null
    if (sale.contract_date) {
      const payMonth = payDateFor(String(sale.contract_date).slice(0, 10))
      if (payMonth && payMonth.getFullYear() === salesFilter.year && payMonth.getMonth() === salesFilter.month) {
        return { percent: 40, type: 'upfront' }
      }
    }
    if (sale.closing_date) {
      const payMonth = payDateFor(String(sale.closing_date).slice(0, 10))
      if (payMonth && payMonth.getFullYear() === salesFilter.year && payMonth.getMonth() === salesFilter.month) {
        return { percent: 60, type: 'closing' }
      }
    }
    return null
  }

  const filterMonthLabel = salesFilter
    ? new Date(salesFilter.year, salesFilter.month, 1).toLocaleString('en', { month: 'long', year: 'numeric' })
    : null

  const filterBannerLabel = isContractMode
    ? 'Contracted in'
    : 'Filtered by payment month'

  const filterSubtitleLabel = salesFilter
    ? (isContractMode ? `contracted in ${filterMonthLabel}` : `paying in ${filterMonthLabel}`)
    : 'total'

  const emptyStateLabel = salesFilter
    ? (isContractMode
        ? `No sales contracted in ${filterMonthLabel}.`
        : `No sales paying out in ${filterMonthLabel}.`)
    : 'No sales yet. Hit "Add Sale" to log your first.'

  // Normalize legacy status for display
  const getStatusDisplay = (status) => {
    if (['pending_earnest', 'secured', 'under_construction'].includes(status)) {
      return STATUS_OPTIONS.find((s) => s.value === 'under_contract')
    }
    if (status === 'paid') {
      return STATUS_OPTIONS.find((s) => s.value === 'closed')
    }
    return STATUS_OPTIONS.find((s) => s.value === status)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-medium">Sales</h2>
          <p className="text-sm text-muted">{visibleSales.length} {filterSubtitleLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="px-3 py-2 bg-white border border-line rounded-lg text-sm font-medium text-ink hover:bg-cream transition cursor-pointer"
            aria-label="Sort sales"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-panel text-onpanel rounded-lg text-sm font-medium hover:bg-panel/90 transition"
          >
            <Plus size={14} /> Add Sale
          </button>
        </div>
      </div>

      {salesFilter && (
        <div className="flex items-center justify-between bg-gold-soft border border-gold/30 rounded-xl px-4 py-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-gold-dark font-medium">{filterBannerLabel}</div>
            <div className="text-sm font-medium text-ink">{filterMonthLabel}</div>
          </div>
          <button
            onClick={clearFilter}
            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-line rounded-lg text-xs font-medium hover:bg-cream transition"
          >
            <X size={12} /> Clear
          </button>
        </div>
      )}

      {visibleSales.length === 0 ? (
        <div className="bg-white border border-line rounded-xl p-10 text-center">
          <p className="text-sm text-muted">{emptyStateLabel}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {monthGroups.map((group) => {
            const collapsed = collapsedMonths[group.key]
            return (
              <div
                key={group.key}
                className="bg-alt border border-line/70 rounded-2xl p-5"
              >
                {/* Month section header */}
                <button
                  onClick={() => toggleMonth(group.key)}
                  className="w-full flex items-end justify-between gap-3 group"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-muted transition-transform ${collapsed ? '' : 'rotate-90'}`}>
                      ›
                    </span>
                    <h3 className="font-display text-xl font-medium text-ink">{group.label}</h3>
                    <span className="text-xs text-subtle font-sans">
                      {group.sales.length} {group.sales.length === 1 ? 'sale' : 'sales'}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase tracking-wider text-subtle font-sans">Commission</div>
                    <div className={`font-display text-base font-medium ${group.commission < 0 ? 'text-red-700' : 'text-gold-dark'}`}>
                      {group.commission < 0 ? `-${fmt(Math.abs(group.commission))}` : fmt(group.commission)}
                    </div>
                  </div>
                </button>

                {!collapsed && (
                  <div className="space-y-2 mt-4">
                    {group.sales.map((sale) => {
                      const status = getStatusDisplay(sale.status)
                      const payment = paymentTypeForSale(sale)
                      const amounts = saleSplitAmounts(sale)
                      const paymentAmount = payment
                        ? (payment.percent === 40 ? amounts.upfront : amounts.closing)
                        : null
                      const isBusted = sale.status === 'busted'
                      const clawback = isBusted ? saleClawback(sale) : 0
                      return (
                        <div
                          key={sale.id}
                          className={`bg-white border rounded-xl p-4 transition ${
                            isBusted ? 'border-red-200 hover:border-red-300' : 'border-line hover:border-gold/40'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <h4 className="font-display text-base font-medium truncate">
                                  {sale.buyer_name}
                                </h4>
                                <span
                                  className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium"
                                  style={{ background: status?.bg, color: status?.color }}
                                >
                                  {status?.label}
                                </span>
                                {isBusted && (
                                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium bg-red-50 text-red-700">
                                    {sale.bust_percent}% clawback
                                  </span>
                                )}
                                {payment && !isBusted && (
                                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium bg-gold-soft text-gold-dark">
                                    {payment.percent}% {payment.type}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted space-y-0.5">
                                {sale.address && <div className="truncate">{sale.address}</div>}
                                <div className="flex items-center gap-3 flex-wrap text-subtle">
                                  {sale.plan_design && <span>{sale.plan_design}</span>}
                                  <span className="capitalize">{sale.build_type}</span>
                                  <span>Split {sale.split}%</span>
                                  {sale.contract_date && (
                                    <span>
                                      {new Date(sale.contract_date).toLocaleDateString('en-US', {
                                        month: 'short', day: 'numeric', year: 'numeric',
                                      })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className={`font-display text-lg font-medium ${isBusted ? 'text-red-700' : 'text-ink'}`}>
                                {isBusted
                                  ? `-${fmt(clawback)}`
                                  : payment ? `+${fmt(paymentAmount)}` : fmt(sale.commission_amount)}
                              </div>
                              <div className="text-[10px] text-subtle uppercase tracking-wider">
                                {isBusted
                                  ? `${sale.bust_percent}% of base commission owed back`
                                  : payment ? `${payment.percent}% of ${fmt(sale.commission_amount)}` : `${fmt(sale.sale_price)} × ${sale.commission_rate}%`}
                              </div>
                              <div className="flex gap-1 mt-2 justify-end">
                                <button
                                  onClick={() => openEdit(sale)}
                                  className="p-1.5 hover:bg-line rounded-lg transition"
                                  aria-label="Edit sale"
                                >
                                  <Edit2 size={13} className="text-muted" />
                                </button>
                                <button
                                  onClick={() => handleDelete(sale.id)}
                                  className="p-1.5 hover:bg-red-50 rounded-lg transition"
                                  aria-label="Delete sale"
                                >
                                  <Trash2 size={13} className="text-red-600" />
                                </button>
                              </div>
                            </div>
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
      )}

      {showForm && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-cream w-full md:max-w-2xl md:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto safe-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-cream border-b border-line p-5 flex items-center justify-between z-10">
              <h3 className="font-display text-xl font-medium">
                {editingId ? 'Edit Sale' : 'New Sale'}
              </h3>
              <div className="flex items-center gap-2">
                {editingId && (
                  <button
                    onClick={() => { handleDelete(editingId); setShowForm(false) }}
                    className="p-2 hover:bg-red-50 rounded-lg transition text-red-600"
                    aria-label="Delete sale"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <button
                  onClick={() => setShowForm(false)}
                  className="p-1.5 hover:bg-line rounded-lg transition"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <Field label="Buyer Name" required>
                <input
                  type="text"
                  value={form.buyer_name}
                  onChange={(e) => setForm({ ...form, buyer_name: e.target.value })}
                  required
                  className="w-full px-3 py-2.5 bg-white border border-line rounded-lg text-sm"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Address">
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white border border-line rounded-lg text-sm"
                  />
                </Field>
                <Field label="Plan / Design">
                  <input
                    type="text"
                    value={form.plan_design}
                    onChange={(e) => setForm({ ...form, plan_design: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white border border-line rounded-lg text-sm"
                  />
                </Field>
              </div>

              <Field label="Build Type">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleBuildTypeChange('inventory')}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium transition border ${
                      form.build_type === 'inventory'
                        ? 'bg-panel text-onpanel border-panel'
                        : 'bg-white text-muted border-line'
                    }`}
                  >
                    Inventory · 2%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBuildTypeChange('dirt')}
                    className={`px-3 py-2.5 rounded-lg text-sm font-medium transition border ${
                      form.build_type === 'dirt'
                        ? 'bg-panel text-onpanel border-panel'
                        : 'bg-white text-muted border-line'
                    }`}
                  >
                    Dirt · 2.5%
                  </button>
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Sale Price">
                  <input
                    type="number"
                    value={form.sale_price}
                    onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
                    required
                    step="100"
                    className="w-full px-3 py-2.5 bg-white border border-line rounded-lg text-sm"
                  />
                </Field>
                <Field label="Commission Rate %">
                  <input
                    type="number"
                    value={form.commission_rate}
                    onChange={(e) => setForm({ ...form, commission_rate: e.target.value })}
                    step="0.1"
                    className="w-full px-3 py-2.5 bg-white border border-line rounded-lg text-sm"
                  />
                </Field>
              </div>

              <Field label="Split">
                <div className="grid grid-cols-4 gap-2">
                  {[100, 80, 70, 20].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm({ ...form, split: s })}
                      className={`px-3 py-2.5 rounded-lg text-sm font-medium transition border ${
                        form.split === s
                          ? 'bg-panel text-onpanel border-panel'
                          : 'bg-white text-muted border-line'
                      }`}
                    >
                      {s}%
                    </button>
                  ))}
                </div>
              </Field>

              <div className="bg-gold-soft border border-gold/30 rounded-xl p-4">
                <div className="text-[10px] uppercase tracking-widest text-gold-dark font-medium mb-1">
                  Commission Preview
                </div>
                <div className="font-display text-2xl font-medium text-ink">
                  {fmt(previewCommission)}
                </div>
                <div className="text-[10px] text-muted mt-1">
                  {isReferral
                    ? `Referral · ${form.split}% of total commission, all upfront`
                    : `Full 40% upfront · ${form.split}% of back-end at close`}
                </div>
                {previewBonus > 0 && (
                  <div className="text-[10px] text-gold-dark mt-1">
                    Includes {fmt(previewBonus)} dirt bonus (0.5%) paid at close
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-gold/20 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <div className="text-subtle uppercase tracking-wider text-[9px]">{isReferral ? 'Upfront (all)' : '40% Upfront (full)'}</div>
                    <div className="font-medium text-ink">{fmt(previewUpfront)}</div>
                  </div>
                  <div>
                    <div className="text-subtle uppercase tracking-wider text-[9px]">
                      {isReferral ? 'At Close' : `Close${splitNum < 100 ? ` (${form.split}%)` : ''}${previewBonus > 0 ? ' + bonus' : ''}`}
                    </div>
                    <div className="font-medium text-ink">{fmt(previewAtClose)}</div>
                  </div>
                </div>
              </div>

              <Field label="Status">
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.filter((s) => s.value !== 'busted').map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setForm({ ...form, status: s.value, bust_percent: null })}
                      className={`px-3 py-2.5 rounded-lg text-sm font-medium transition border ${
                        form.status === s.value
                          ? 'bg-panel text-onpanel border-panel'
                          : 'bg-white text-muted border-line'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="border border-line rounded-xl bg-cream/40 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowBustSection((v) => !v)}
                  className="w-full flex items-center justify-between p-4"
                >
                  <div className="text-left">
                    <div className="text-[10px] uppercase tracking-widest text-muted font-medium">
                      Deal Busted?
                    </div>
                    {!showBustSection && form.bust_percent && (
                      <div className="text-[11px] text-red-700 font-medium mt-0.5">
                        {form.bust_percent}% bust marked · -{fmt(previewClawback)}
                      </div>
                    )}
                  </div>
                  <span className={`text-muted transition-transform ${showBustSection ? 'rotate-90' : ''}`}>
                    ›
                  </span>
                </button>
                {showBustSection && (
                  <div className="px-4 pb-4">
                    <p className="text-[11px] text-muted mb-3">
                      Buyer backed out after upfront was paid — mark how much of the base commission has to be paid back.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleBustToggle(20)}
                        className={`px-3 py-2.5 rounded-lg text-sm font-medium transition border ${
                          form.bust_percent === 20
                            ? 'bg-panel text-onpanel border-panel'
                            : 'bg-white text-muted border-line'
                        }`}
                      >
                        20% Bust
                      </button>
                      <button
                        type="button"
                        onClick={() => handleBustToggle(40)}
                        className={`px-3 py-2.5 rounded-lg text-sm font-medium transition border ${
                          form.bust_percent === 40
                            ? 'bg-panel text-onpanel border-panel'
                            : 'bg-white text-muted border-line'
                        }`}
                      >
                        40% Bust
                      </button>
                    </div>
                    {form.bust_percent && (
                      <div className="mt-3 pt-3 border-t border-line space-y-3">
                        <div>
                          <div className="text-[9px] uppercase tracking-wider text-muted">Amount owed back</div>
                          <div className="font-display text-xl font-medium text-red-700">
                            -{fmt(previewClawback)}
                          </div>
                          <div className="text-[10px] text-muted mt-0.5">
                            {form.bust_percent}% of base commission ({fmt(previewBaseComm)})
                          </div>
                        </div>
                    <div>
                      <label className="block text-[9px] uppercase tracking-wider text-muted font-medium mb-1">
                        Bust Date
                      </label>
                      <input
                        type="date"
                        value={form.bust_date}
                        onChange={(e) => setForm({ ...form, bust_date: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-line rounded-lg text-sm"
                      />
                      <p className="text-[10px] text-muted mt-1">
                        Determines which month's check the clawback comes out of — deducted the month AFTER this date, on the 7th.
                      </p>
                    </div>
                  </div>
                )}
                </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Contract Date">
                  <input
                    type="date"
                    value={form.contract_date}
                    onChange={(e) => setForm({ ...form, contract_date: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white border border-line rounded-lg text-sm"
                  />
                </Field>
                <Field label="Closing Date">
                  <input
                    type="date"
                    value={form.closing_date}
                    onChange={(e) => setForm({ ...form, closing_date: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white border border-line rounded-lg text-sm"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Realtor">
                  <input
                    type="text"
                    value={form.realtor_name}
                    onChange={(e) => setForm({ ...form, realtor_name: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white border border-line rounded-lg text-sm"
                  />
                </Field>
                <Field label="Lead Source">
                  <input
                    type="text"
                    value={form.lead_source}
                    onChange={(e) => setForm({ ...form, lead_source: e.target.value })}
                    className="w-full px-3 py-2.5 bg-white border border-line rounded-lg text-sm"
                  />
                </Field>
              </div>

              <Field label="Notes">
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2.5 bg-white border border-line rounded-lg text-sm resize-none"
                />
              </Field>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-3 border border-line rounded-lg text-sm font-medium hover:bg-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-3 bg-panel text-onpanel rounded-lg text-sm font-medium hover:bg-panel/90 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
                >
                  <Check size={14} />
                  {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Sale'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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
