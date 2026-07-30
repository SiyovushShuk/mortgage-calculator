import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

export const CURRENCY_SYMBOLS = ['¤', '₿', '฿', '✦'] as const

export type CurrencySymbol = (typeof CURRENCY_SYMBOLS)[number]

type CurrencyContextValue = {
  currencySymbol: CurrencySymbol
  setCurrencySymbol: (value: CurrencySymbol) => void
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currencySymbol, setCurrencySymbol] = useState<CurrencySymbol>('¤')

  const value = useMemo(
    () => ({ currencySymbol, setCurrencySymbol }),
    [currencySymbol],
  )

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext)
  if (!ctx) {
    throw new Error('CurrencyProvider is missing')
  }
  return ctx
}

