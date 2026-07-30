const numberFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
})

const moneyFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 2,
})

const percentFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 1,
})

function withSpaces(value: string): string {
  return value.replace(/\u00A0/g, ' ')
}

export function formatMoney(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0
  return withSpaces(moneyFormatter.format(safe))
}

export function formatCurrency(amount: number, currencySymbol: string): string {
  return `${formatMoney(amount)} ${currencySymbol}`
}

export function formatNumber(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0
  return withSpaces(numberFormatter.format(safe))
}

export function formatPercent(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0
  return withSpaces(percentFormatter.format(safe))
}
