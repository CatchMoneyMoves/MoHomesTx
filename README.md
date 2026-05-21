# Mo's Tracker

Sales + finance dashboard for new home sales — built with React, Vite, and Supabase.

> 🦁 Discipline beats talent. Consistency beats charm.

## What's inside

- **Dashboard** — YTD commission, goal progress, pace insight, monthly chart, pipeline donut
- **Sales** — Add/edit/delete sales with auto-calculated commission (price × rate × split)
- **Journal** — Quarterly drill-down with chart toggle (bar/line) + date toggle (contract/closing)
- **Cash** — Account balances, net worth tracking
- **Money** — Income/expense tracking with 6-month chart
- **Settings** — Goal, default commission rate, name, sign out

All data lives in Supabase with Row Level Security — only you see your data.

---

## First time setup

You only do this once.

### 1. Install Node.js
If you don't already have it: download from [nodejs.org](https://nodejs.org) (LTS version).

Confirm it works:
```bash
node -v
npm -v
```

### 2. Install dependencies
From this folder:
```bash
npm install
```

This downloads everything the project needs into `node_modules/` (~150MB).

### 3. Run it
```bash
npm run dev
```

You'll see something like:
```
  VITE v5.x.x  ready in 400 ms
  ➜  Local:   http://localhost:5173/
```

Open `http://localhost:5173` in your browser.

### 4. Sign up
On the login screen, hit **"Create account"**, enter your email + password, click submit. Supabase emails you a confirmation link — click it. Then sign in normally.

---

## Daily use

Just run:
```bash
npm run dev
```

…and visit `http://localhost:5173`.

To stop the dev server: `Ctrl + C` in the terminal.

---

## Deploying to Vercel (cloud, accessible from phone)

When you're ready to have this live on the internet so your phone can access it:

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
gh repo create MoHomesTx --private --source=. --push
```

(If you don't have GitHub CLI: create a private repo on github.com manually, then push to it.)

### 2. Deploy to Vercel
1. Go to [vercel.com](https://vercel.com) → import the `MoHomesTx` repo
2. Vercel auto-detects Vite — leave settings default
3. **Add environment variables** (this is critical):
   - `VITE_SUPABASE_URL` → your project URL
   - `VITE_SUPABASE_ANON_KEY` → your publishable key
4. Deploy

You'll get a URL like `mohomestx.vercel.app`.

### 3. Update Supabase URL config
In Supabase → Authentication → URL Configuration:
- Add your Vercel URL to the **Redirect URLs** list: `https://mohomestx.vercel.app/**`
- Optionally update **Site URL** to your Vercel URL

### 4. Add to iPhone home screen
Visit your Vercel URL on Safari → Share → Add to Home Screen. Now you have a real app icon.

---

## File structure

```
mohomestx/
├── .env.local              ← Supabase credentials (NEVER commit)
├── .env.example            ← Template for others (safe to commit)
├── public/                 ← Icons, favicon
├── src/
│   ├── lib/
│   │   ├── supabase.js     ← Supabase client
│   │   └── auth.js         ← Sign in / sign up / magic link
│   ├── hooks/              ← Custom hooks for Supabase data
│   │   ├── useAuth.js
│   │   ├── useSales.js
│   │   ├── useAccounts.js
│   │   ├── useTransactions.js
│   │   └── useSettings.js
│   ├── components/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Sales.jsx
│   │   ├── Journal.jsx
│   │   ├── Cash.jsx
│   │   ├── Transactions.jsx
│   │   └── Settings.jsx
│   ├── App.jsx             ← Main router + auth gate
│   ├── main.jsx
│   └── index.css
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

---

## Notes

- **Commission** is computed by the database (`sale_price × commission_rate% × split%`) — you can't enter it manually, it's always derived. Live preview shows in the sales form.
- **Build type toggle** auto-sets the rate (Inventory = 2%, Dirt = 2.5%). You can override after.
- **Splits** are 100 / 80 / 20.
- **Status** options: Pending Earnest → Secured → Under Construction → Closed → Paid Out (or Cancelled).
- **Auth** supports both email+password and magic link (passwordless).
- **Settings** auto-creates on first signup with $180k annual goal.

---

🦁 Built with discipline.
