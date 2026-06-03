// Perry payment schedule logic
// Contract signed month X → 40% paid 7th of month X+1
// Closing in month Y → 60% paid 7th of month Y+1
// Applies to both inventory (2%) and dirt (2.5%)

const PAY_DAY = 7

function nextMonth7th(dateStr) {
  if (!dateStr) return null
  // Parse as local date (not UTC) to avoid timezone-off-by-one-day bug.
  // new Date('YYYY-MM-DD') parses as UTC midnight, which in US timezones
  // rolls back to the previous day — causing the wrong month to be used.
  // e.g. '2026-07-01' UTC = June 30 in CDT → getMonth() returns June → +1 = July (wrong)
  const [year, month, day] = dateStr.split('-').map(Number)
  if (!year || !month || !day) return null
  // month is already 1-indexed from the string; Date constructor is 0-indexed.
  // So passing `month` directly (not month-1) advances one month automatically.
  return new Date(year, month, PAY_DAY)
}

/**
 * Returns an array of expected payments from a sale.
 * Each payment: { date, amount, type, saleId, buyerName, percent, status }
 */
export function paymentsFromSale(sale) {
  if (!sale || sale.status === 'cancelled') return []
  const commission = Number(sale.commission_amount || 0)
  if (commission <= 0) return []

  const payments = []

  // 40% upfront — based on contract date
  if (sale.contract_date) {
    const payDate = nextMonth7th(sale.contract_date)
    if (payDate) {
      payments.push({
        date: payDate,
        amount: commission * 0.4,
        percent: 40,
        type: 'upfront',
        saleId: sale.id,
        buyerName: sale.buyer_name,
        salePrice: Number(sale.sale_price || 0),
        contractDate: sale.contract_date,
        closingDate: sale.closing_date,
        status: sale.status,
      })
    }
  }

  // 60% on close — only if there's a closing date
  if (sale.closing_date) {
    const payDate = nextMonth7th(sale.closing_date)
    if (payDate) {
      payments.push({
        date: payDate,
        amount: commission * 0.6,
        percent: 60,
        type: 'closing',
        saleId: sale.id,
        buyerName: sale.buyer_name,
        salePrice: Number(sale.sale_price || 0),
        contractDate: sale.contract_date,
        closingDate: sale.closing_date,
        status: sale.status,
      })
    }
  }

  return payments
}

/**
 * Build full payment forecast across all sales.
 * Returns array of payments, sorted by date ascending.
 */
export function forecastPayments(sales) {
  const all = []
  sales.forEach((sale) => {
    all.push(...paymentsFromSale(sale))
  })
  all.sort((a, b) => a.date - b.date)
  return all
}

/**
 * Group payments by year-month for chart/table display.
 * Returns: [{ year, month, label, total, payments }]
 */
export function groupByMonth(payments) {
  const map = new Map()
  payments.forEach((p) => {
    const y = p.date.getFullYear()
    const m = p.date.getMonth()
    const key = `${y}-${m}`
    if (!map.has(key)) {
      map.set(key, {
        year: y,
        month: m,
        label: p.date.toLocaleString('en', { month: 'short', year: 'numeric' }),
        shortLabel: p.date.toLocaleString('en', { month: 'short' }),
        total: 0,
        payments: [],
      })
    }
    const bucket = map.get(key)
    bucket.total += p.amount
    bucket.payments.push(p)
  })
  return Array.from(map.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.month - b.month
  })
}

/**
 * Filter payments to a date range.
 */
export function paymentsInRange(payments, start, end) {
  return payments.filter((p) => p.date >= start && p.date <= end)
}

/**
 * Past vs future payments.
 */
export function splitPaymentsByDate(payments, asOf = new Date()) {
  const past = []
  const upcoming = []
  payments.forEach((p) => {
    if (p.date < asOf) past.push(p)
    else upcoming.push(p)
  })
  return { past, upcoming }
}
