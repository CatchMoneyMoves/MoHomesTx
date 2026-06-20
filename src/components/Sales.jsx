import { useState } from 'react'
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react'

const STATUS_OPTIONS = [
  { value: 'under_contract', label: 'Under Contract', color: '#1d4ed8', bg: '#dbeafe' },
  { value: 'closed', label: 'Closed', color: '#047857', bg: '#d1fae5' },
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
}

export default function Sales({ sales, addSale, updateSale, deleteSale, defaultRate, salesFilter, clearFilter }) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [collapsedMonths, setCollapsedMonths] = useState({})

  const openAdd = () => {
    setForm({ ...emptyForm, commission_rate: defaultRate || 2.0 })
    setEditingId(null)
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
    })
    setEditingId(sale.id)
    setShowForm(true)
  }

  const handleBuildTypeChange = (type) => {
    setForm((f) => ({
      ...f,
      build_type: type,
      commission_rate: type === 'dirt' ? 2.5 : 2.0,
    }))
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

  // Upfront = full 40% of base 2% (never reduced by split).
  // Closing = (60% of base + full dirt bonus) × split share.
  const previewBaseRate = Math.min(rateNum, BASE_RATE)
  const previewBaseComm = salePriceNum * (previewBaseRate / 100)
  const previewBonus = salePriceNum * (Math.max(0, rateNum - BASE_RATE) / 100)
  const previewUpfront = previewBaseComm * 0.4
  const previewAtClose = (previewBaseComm * 0.6 + previewBonus) * (splitNum / 100)
  const previewCommission = previewUpfront + previewAtClose

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
    // Perry pays 40% upfront on 7th of month AFTER contract, 60% on 7th of month AFTER closing
    if (sale.contract_date) {
      const cd = new Date(sale.contract_date)
      const payMonth = new Date(cd.getFullYear(), cd.getMonth() + 1, 7)
      if (payMonth.getFullYear() === salesFilter.year && payMonth.getMonth() === salesFilter.month) {
        return true
      }
    }
    if (sale.closing_date) {
      const cd = new Date(sale.closing_date)
      const payMonth = new Date(cd.getFullYear(), cd.getMonth() + 1, 7)
      if (payMonth.getFullYear() === salesFilter.year && payMonth.getMonth() === salesFilter.month) {
        return true
      }
    }
    return false
  }

  const visibleSales = sales
    .filter((s) => s.status !== 'cancelled')
    .filter(filterMatchesSale)

  // Group sales into month sections. Groups by closing_date when present,
  // else contract_date. Sorted newest month first; sales within a month
  // sorted by their grouping date descending. Months with no sales are skipped.
  const groupSalesByMonth = (list) => {
    const groups = new Map()
    list.forEach((sale) => {
      const dateStr = sale.closing_date || sale.contract_date
      if (!dateStr) {
        // Undated sales bucket together at the end
        const key = 'undated'
        if (!groups.has(key)) {
          groups.set(key, { key, year: -1, month: -1, label: 'No date', sales: [], commission: 0, sortDate: 0 })
        }
        const g = groups.get(key)
        g.sales.push(sale)
        g.commission += Number(sale.commission_amount || 0)
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
      g.commission += Number(sale.commission_amount || 0)
    })
    const arr = Array.from(groups.values())
    // Sort sections: dated months newest first, undated last
    arr.sort((a, b) => b.sortDate - a.sortDate)
    // Sort sales within each month by grouping date descending
    arr.forEach((g) => {
      g.sales.sort((a, b) => {
        const da = new Date(a.closing_date || a.contract_date || 0).getTime()
        const db = new Date(b.closing_date || b.contract_date || 0).getTime()
        return db - da
      })
    })
    return arr
  }

  const monthGroups = groupSalesByMonth(visibleSales)
  const toggleMonth = (key) => setCollapsedMonths((p) => ({ ...p, [key]: !p[key] }))

  // Compute the actual upfront/close amounts for a sale (bonus loads onto close)
  const saleSplitAmounts = (sale) => {
    const price = Number(sale.sale_price || 0)
    const rate = Number(sale.commission_rate || 0)
    const split = Number(sale.split || 100) / 100
    const baseComm = price * (Math.min(rate, BASE_RATE) / 100)
    const bonus = price * (Math.max(0, rate - BASE_RATE) / 100)
    // Upfront: full 40% of base (no split). Closing: (60% base + bonus) × split.
    return { upfront: baseComm * 0.4, closing: (baseComm * 0.6 + bonus) * split }
  }

  // Only show payment-type badges in payment mode
  const paymentTypeForSale = (sale) => {
    if (!salesFilter || isContractMode) return null
    if (sale.contract_date) {
      const cd = new Date(sale.contract_date)
      const payMonth = new Date(cd.getFullYear(), cd.getMonth() + 1, 7)
      if (payMonth.getFullYear() === salesFilter.year && payMonth.getMonth() === salesFilter.month) {
        return { percent: 40, type: 'upfront' }
      }
    }
    if (sale.closing_date) {
      const cd = new Date(sale.closing_date)
      const payMonth = new Date(cd.getFullYear(), cd.getMonth() + 1, 7)
      if (payMonth.getFullYear() === salesFilter.year && payMonth.getMonth() === salesFilter.month) {
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
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-4 py-2 bg-ink text-cream rounded-lg text-sm font-medium hover:bg-ink/90 transition"
        >
          <Plus size={14} /> Add Sale
        </button>
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
        <div className="space-y-6">
          {monthGroups.map((group) => {
            const collapsed = collapsedMonths[group.key]
            return (
              <div key={group.key} className="space-y-2">
                {/* Month section header */}
                <button
                  onClick={() => toggleMonth(group.key)}
                  className="w-full flex items-end justify-between gap-3 pb-2 border-b border-line group"
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
                    <div className="font-display text-base font-medium text-gold-dark">{fmt(group.commission)}</div>
                  </div>
                </button>

                {!collapsed && (
                  <div className="space-y-2">
                    {group.sales.map((sale) => {
                      const status = getStatusDisplay(sale.status)
                      const payment = paymentTypeForSale(sale)
                      const amounts = saleSplitAmounts(sale)
                      const paymentAmount = payment
                        ? (payment.percent === 40 ? amounts.upfront : amounts.closing)
                        : null
                      return (
                        <div
                          key={sale.id}
                          className="bg-white border border-line rounded-xl p-4 hover:border-gold/40 transition"
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
                                {payment && (
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
                              <div className="font-display text-lg font-medium text-ink">
                                {payment ? `+${fmt(paymentAmount)}` : fmt(sale.commission_amount)}
                              </div>
                              <div className="text-[10px] text-subtle uppercase tracking-wider">
                                {payment ? `${payment.percent}% of ${fmt(sale.commission_amount)}` : `${fmt(sale.sale_price)} × ${sale.commission_rate}%`}
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
          className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4"
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
                        ? 'bg-ink text-cream border-ink'
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
                        ? 'bg-ink text-cream border-ink'
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
                          ? 'bg-ink text-cream border-ink'
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
                  Full 40% upfront · {form.split}% of back-end at close
                </div>
                {previewBonus > 0 && (
                  <div className="text-[10px] text-gold-dark mt-1">
                    Includes {fmt(previewBonus)} dirt bonus (0.5%) paid at close
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-gold/20 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <div className="text-subtle uppercase tracking-wider text-[9px]">40% Upfront (full)</div>
                    <div className="font-medium text-ink">{fmt(previewUpfront)}</div>
                  </div>
                  <div>
                    <div className="text-subtle uppercase tracking-wider text-[9px]">
                      Close{splitNum < 100 ? ` (${form.split}%)` : ''}{previewBonus > 0 ? ' + bonus' : ''}
                    </div>
                    <div className="font-medium text-ink">{fmt(previewAtClose)}</div>
                  </div>
                </div>
              </div>

              <Field label="Status">
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setForm({ ...form, status: s.value })}
                      className={`px-3 py-2.5 rounded-lg text-sm font-medium transition border ${
                        form.status === s.value
                          ? 'bg-ink text-cream border-ink'
                          : 'bg-white text-muted border-line'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </Field>

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
                  className="flex-1 px-4 py-3 bg-ink text-cream rounded-lg text-sm font-medium hover:bg-ink/90 disabled:opacity-50 transition flex items-center justify-center gap-1.5"
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
