import { useState } from 'react'
import { LayoutDashboard, Home, Wallet, Settings as SettingsIcon, Loader2 } from 'lucide-react'

import { useAuth } from './hooks/useAuth'
import { useSales } from './hooks/useSales'
import { useAccounts } from './hooks/useAccounts'
import { useTransactions } from './hooks/useTransactions'
import { useSettings } from './hooks/useSettings'

import Login from './components/Login'
import Dashboard from './components/Dashboard'
import Sales from './components/Sales'
import MoMoney from './components/MoMoney'
import SettingsView from './components/Settings'

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'sales', label: 'Sales', icon: Home },
  { id: 'momoney', label: 'MoMoney', icon: Wallet },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

export default function App() {
  const { user, loading: authLoading } = useAuth()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [salesFilter, setSalesFilter] = useState(null) // { year, month, type: 'upfront'|'closing' } | null

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <Loader2 className="animate-spin text-gold" size={28} />
      </div>
    )
  }

  if (!user) return <Login />

  return (
    <AuthedApp
      user={user}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      salesFilter={salesFilter}
      setSalesFilter={setSalesFilter}
    />
  )
}

function AuthedApp({ user, activeTab, setActiveTab, salesFilter, setSalesFilter }) {
  const { sales, loading: salesLoading, addSale, updateSale, deleteSale } = useSales(user)
  const { accounts, addAccount, updateAccount, deleteAccount } = useAccounts(user)
  const { transactions, addTransaction, deleteTransaction } = useTransactions(user)
  const { settings, updateSettings } = useSettings(user)

  return (
    <div className="min-h-screen bg-cream text-ink pb-24 md:pb-6">
      {/* Desktop header */}
      <header className="hidden md:block border-b border-line bg-cream/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-ink flex items-center justify-center">
              <span className="font-display text-lg font-semibold text-gold leading-none -mt-0.5">M</span>
            </div>
            <span className="font-display text-base font-medium tracking-tight">MoHomes Tracker</span>
          </div>
          <nav className="flex items-center gap-1">
            {TABS.map((t) => {
              const Icon = t.icon
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    activeTab === t.id ? 'bg-ink text-cream' : 'text-muted hover:bg-white'
                  }`}
                >
                  <Icon size={14} />
                  {t.label}
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      {/* Mobile header */}
      <header className="md:hidden border-b border-line bg-cream sticky top-0 z-30 safe-top">
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-ink flex items-center justify-center">
              <span className="font-display text-lg font-semibold text-gold leading-none -mt-0.5">M</span>
            </div>
            <span className="font-display text-base font-medium tracking-tight">MoHomes Tracker</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 md:px-6 py-6">
        {salesLoading && activeTab === 'dashboard' ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-gold" size={24} />
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <Dashboard sales={sales} accounts={accounts} settings={settings} setActiveTab={setActiveTab} />
            )}
            {activeTab === 'sales' && (
              <Sales
                sales={sales}
                addSale={addSale}
                updateSale={updateSale}
                deleteSale={deleteSale}
                defaultRate={settings.default_commission_rate}
                salesFilter={salesFilter}
                clearFilter={() => setSalesFilter(null)}
              />
            )}
            {activeTab === 'momoney' && (
              <MoMoney
                sales={sales}
                accounts={accounts}
                addAccount={addAccount}
                updateAccount={updateAccount}
                deleteAccount={deleteAccount}
                transactions={transactions}
                addTransaction={addTransaction}
                deleteTransaction={deleteTransaction}
                goToSales={(filter) => {
                  setSalesFilter(filter)
                  setActiveTab('sales')
                }}
              />
            )}
            {activeTab === 'settings' && (
              <SettingsView settings={settings} updateSettings={updateSettings} user={user} />
            )}
          </>
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-cream border-t border-line safe-bottom z-30">
        <div className="grid grid-cols-4">
          {TABS.map((t) => {
            const Icon = t.icon
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 transition ${
                  active ? 'text-ink' : 'text-subtle'
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 1.75} />
                <span className={`text-[9px] uppercase tracking-wider ${active ? 'font-semibold' : 'font-medium'}`}>
                  {t.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
