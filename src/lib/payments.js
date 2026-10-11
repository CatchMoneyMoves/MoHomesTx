// Perry payment schedule logic
// Contract signed → 40% paid on that date's pay period (see payDateFor)
// Closing → 60% paid on the closing date's pay period
//
// Commission model:
//   - Upfront (40%) is ALWAYS the full 40% of the BASE 2% commission.
//     It is never reduced by the split — you collect the whole upfront.
//   - Closing (60%) is the remaining 60% of the base PLUS the full dirt
//     bonus (any rate above 2%, e.g. the 0.5% on Dirt). The split %
//     applies ONLY to this closing payment (your share of the back end).
//   - 100% split = you keep the entire closing too.
//
// Busted deals:
//   - A bust means the upfront (40%) was already paid, then the deal fell
//     through — so the original upfront payment still happened (real money
//     you received), but a clawback of bust_percent% of BASE commission is
//     owed back. No closing payment ever occurs for a busted deal.
//   - Clawback amount = base commission (sale_price × min(rate, 2%)) ×
//     (bust_percent / 100), shown as a NEGATIVE payment so it subtracts
//     directly from Collected/Upcoming totals and month groupings.
//   - There's no dedicated bust_date field yet, so the clawback is dated
//     off closing_date if set, else contract_date, else today. Add a
//     bust_date column later if you want this to be precise rather than
//     inferred.

const BASE_RATE = 2 // % — base commission. Anything above is bonus, loads onto close.

// Semi-monthly pay periods:
//   1st–15th  → paid the 22nd of the SAME month
//   16th–end  → paid the 7th of the NEXT month
const FIRST_HALF_PAY_DAY = 22
const SECOND_HALF_PAY_DAY = 7

function payDateFor(dateStr) {
  if (!dateStr) return null
  // Parse as local date (not UTC) to avoid timezone-off-by-one-day bug.
  // new Date('YYYY-MM-DD') parses as UTC midnight, which in US timezones
  // rolls back to the previous day — causing the wrong period to be used.
  const [year, month, day] = dateStr.split('-').map(Number)
  if (!year || !month || !day) return null
  // month is 1-indexed from the string; Date is 0-indexed.
  if (day <= 15) return new Date(year, month - 1, FIRST_HALF_PAY_DAY)
  // Passing `month` (1-indexed) advances one month; Dec rolls into Jan.
  return new Date(year, month, SECOND_HALF_PAY_DAY)
}

/**
 * Split a sale into upfront + closing payments.
 *  - upfront = 40% of the FULL base-2% commission (split does NOT reduce it)
 *  - closing = (60% of base + full dirt bonus) × split%
 * Returns { upfront, closing }.
 */
function splitCommission(sale) {
  const salePrice = Number(sale.sale_price || 0)
  const rate = Number(sale.commission_rate || 0)
  const splitPct = Number(sale.split || 100)
  const split = splitPct / 100
  if (salePrice <= 0 || rate <= 0) return { upfront: 0, closing: 0 }

  // Referral split (20%): your cut is your % of the TOTAL deal commission,
  // paid 100% upfront with nothing at close.
  if (splitPct <= 20) {
    const totalCommission = salePrice * (rate / 100)
    return { upfront: totalCommission * split, closing: 0 }
  }

  // Standard splits (70/80/100): full 40% upfront of base 2%, never reduced
  // by split; closing is (60% of base + full bonus) × your split share.
  const baseRate = Math.min(rate, BASE_RATE)
  const baseCommission = salePrice * (baseRate / 100)

  // Bonus = anything earned above 2% (e.g. the 0.5% on Dirt)
  const bonusRate = Math.max(0, rate - BASE_RATE)
  const bonus = salePrice * (bonusRate / 100)

  // Upfront: full 40% of base, NOT reduced by split
  const upfront = baseCommission * 0.4

  // Closing: (60% of base + full bonus), then your split share
  const closing = (baseCommission * 0.6 + bonus) * split

  return { upfront, closing }
}

/**
 * Clawback amount owed back on a busted sale — bust_percent% of BASE
 * commission (sale_price × min(rate, 2%)), independent of split.
 */
function clawbackAmount(sale) {
  const salePrice = Number(sale.sale_price || 0)
  const rate = Number(sale.commission_rate || 0)
  const bustPercent = Number(sale.bust_percent || 0)
  if (salePrice <= 0 || rate <= 0 || bustPercent <= 0) return 0
  const baseRate = Math.min(rate, BASE_RATE)
  const baseCommission = salePrice * (baseRate / 100)
  return baseCommission * (bustPercent / 100)
}

/**
 * Clawback payment date: the pay date for the period the bust actually
 * happened (sale.bust_date). Falls back to closing_date, then
 * contract_date, then today only if bust_date wasn't recorded — those
 * fallbacks are approximate and shouldn't be relied on for real deals.
 */
function clawbackDate(sale) {
  return (
    payDateFor(sale.bust_date) ||
    payDateFor(sale.closing_date) ||
    payDateFor(sale.contract_date) ||
    new Date()
  )
}

/**
 * Returns an array of expected payments from a sale.
 */
export function paymentsFromSale(sale) {
  if (!sale || sale.status === 'cancelled') return []

  const payments = []

  // Busted deal: the upfront (if any) already happened historically — keep
  // it — but no closing ever occurs, and a negative clawback is added.
  if (sale.status === 'busted') {
    const { upfront } = splitCommission(sale)

    if (sale.contract_date && upfront > 0) {
      const payDate = payDateFor(sale.contract_date)
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

    const clawback = clawbackAmount(sale)
    if (clawback > 0) {
      payments.push({
        date: clawbackDate(sale),
        amount: -clawback,
        percent: Number(sale.bust_percent || 0),
        type: 'bust',
        saleId: sale.id,
        buyerName: sale.buyer_name,
        salePrice: Number(sale.sale_price || 0),
        contractDate: sale.contract_date,
        closingDate: sale.closing_date,
        status: sale.status,
      })
    }

    return payments
  }

  const { upfront, closing } = splitCommission(sale)
  if (upfront <= 0 && closing <= 0) return []

  // Upfront — based on contract date (full 40% of base 2%)
  if (sale.contract_date && upfront > 0) {
    const payDate = payDateFor(sale.contract_date)
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

  // Closing — based on closing date (60% of base + bonus, × split)
  if (sale.closing_date && closing > 0) {
    const payDate = payDateFor(sale.closing_date)
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
  const tomorrow = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate() + 1)
  const past = []
  const upcoming = []
  payments.forEach((p) => {
    if (p.date < tomorrow) past.push(p)
    else upcoming.push(p)
  })
  return { past, upcoming }
}
