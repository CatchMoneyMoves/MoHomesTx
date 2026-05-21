# MoHomes Tracker · v3 Deploy Instructions

## What changed in v3
- Brand: "MoHomes Tracker" (was Mo's Tracker)
- Dual goals: Commission ($180K) + Sales Volume ($10M) — toggle on Dashboard
- Sales statuses simplified: **Under Contract** (default) + **Closed** only
- Dashboard now shows quarters Q1–Q4 (no separate Journal tab)
- MoMoney tab combines income forecast + accounts + transactions
- **NEW: Income forecast from sales** — Perry's 40/60 payment schedule
  - 40% upfront paid on 7th of month AFTER contract date
  - 60% paid on 7th of month AFTER closing date
  - Example: Sold in May → 40% on June 7th; Closes July 14 → 60% on August 7th
- Chase CSV import with auto-categorization

## Step 1 — Run MIGRATION_v3.sql in Supabase
1. Open https://supabase.com/dashboard/project/ncyzhbvodxeklxclnsot/sql
2. New query → paste contents of `MIGRATION_v3.sql` → Run
3. This normalizes any old statuses to under_contract/closed

## Step 2 — Deploy
### Option A: Push to GitHub → auto-deploy on Vercel
```bash
cd ~/Downloads/mohomestx
# fix git email if needed (use your real email or the no-reply one)
git config user.email "278199945+CatchMoneyMoves@users.noreply.github.com"
git add .
git commit -m "v3: MoHomes Tracker + income forecast + simplified statuses"
git push
```
Vercel will auto-deploy. Visit https://mohomestx.vercel.app

### Option B: Build locally + drag to Vercel
```bash
cd ~/Downloads/mohomestx
npm install
npm run build
# Then drag the /dist folder onto vercel.com/new
```

## Step 3 — Test locally first
```bash
cd ~/Downloads/mohomestx
npm install
npm run dev
# Open http://localhost:5173
```

## Files in this update
- `MIGRATION_v3.sql` (run in Supabase)
- `src/lib/payments.js` (NEW — payment forecast logic)
- `src/components/Sales.jsx` (rewritten — 2 statuses + delete in modal)
- `src/components/MoMoney.jsx` (rewritten — income forecast hero)
- `src/components/Dashboard.jsx` (status normalization for legacy data)
- `src/App.jsx` (passes sales prop to MoMoney)
