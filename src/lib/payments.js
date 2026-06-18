// Perry payment schedule logic
// Contract signed month X → 40% paid 7th of month X+1
// Closing in month Y → 60% paid 7th of month Y+1
// Applies to both inventory (2%) and dirt (2.5%)
//
// Dirt bonus rule: on Dirt sales the rate is 2.5% vs the 2% base. The extra
// 0.5% "bonus" is paid ENTIRELY at close (rides on the 60% payment) rather
// than being split 40/60 like the base commission.

const PAY_DAY = 7
const BASE_RATE = 2 // % — the portion that splits 40/60. Anything above this loads onto close.

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
 * Split a sale's total commission into the upfront (40%) and closing portions.
 * The base-rate commission splits 40/60. Any bonus above the base rate
 * (e.g. the 0.5% on Dirt) is added entirely to the closing portion.
 * Returns { upfront, closing }.
 */
function splitCommission(sale) {
  const commission = Number(sale.commission_amount || 0)
  if (commission <= 0) return { upfront: 0, closing: 0 }

  const salePrice = Number(sale.sale_price || 0)
  const rate = Number(sale.commission_rate || 0)
  const split = Number(sale.split || 100)

  // Bonus = the portion of commission earned above the 2% base rate.
  // Computed from the same inputs the DB uses: price × bonusRate% × split%.
  const bonusRate = Math.max(0, rate - BASE_RATE)
  let bonus = salePrice * (bonusRate / 100) * (split / 100)
  // Guard: bonus can never exceed total commission (e.g. odd manual entries)
  if (bonus > commission) bonus = commission
  if (bonus < 0) bonus = 0

  const base = commission - bonus
  return {
    upfront: base * 0.4,
    closing: base * 0.6 + bonus,
  }
}

/**
 * Returns an array of expected payments from a sale.
 * Each payment: { date, amount, type, saleId, buyerName, percent, status }
 */
export function paymentsFromSale(sale) {
  if (!sale || sale.status === 'cancelled') return []
  const commission = Number(sale.commission_amount || 0)
  if (commission <= 0) return []

  const { upfront, closing } = splitCommission(sale)
  const payments = []

  // Upfront — based on contract date (40% of base commission)
  if (sale.contract_date && upfront > 0) {
    const payDate = nextMonth7th(sale.contract_date)
    if (payDate) {
      payments.push({
        date: payDate,
        amount: upfront,
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

  // Closing — based on closing date (60% of base + the full bonus)
  if (sale.closing_date && closing > 0) {
    const payDate = nextMonth7th(sale.closing_date)
    if (payDate) {
      payments.push({
        date: payDate,
        amount: closing,
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
 * Payments dated today or earlier → past (collected).
 * Payments dated tomorrow or later → upcoming.
 */
export function splitPaymentsByDate(payments, asOf = new Date()) {
  // Use start of tomorrow as the cutoff so that payments dated today
  // (e.g. the 7th at midnight) count as collected on the 7th itself,
  // not on the 8th.
  const tomorrow = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate() + 1)
  const past = []
  const upcoming = []
  payments.forEach((p) => {
    if (p.date < tomorrow) past.push(p)
    else upcoming.push(p)
  })
  return { past, upcoming }
}
