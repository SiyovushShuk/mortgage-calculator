export type TermUnit = 'years' | 'months'

export type PaymentType = 'annuity' | 'differentiated'

export type DownPaymentMode = 'percent' | 'amount'

export type DifferentiatedRow = {
  month: number
  payment: number
  principalPart: number
  interestPart: number
  balanceBefore: number
  balanceAfter: number
}

export type EarlyRepaymentRow = {
  month: number
  payment: number
  interestPart: number
  principalPart: number
  extraPaymentPart: number
  balanceAfter: number
}

export function toMonths(value: number, unit: TermUnit): number {
  if (!Number.isFinite(value) || value <= 0) return 0
  if (unit === 'years') return Math.round(value * 12)
  return Math.round(value)
}

export function calcDownPaymentAmount(
  propertyPrice: number,
  downPaymentPercent: number,
): number {
  if (!Number.isFinite(propertyPrice) || propertyPrice <= 0) return 0
  if (!Number.isFinite(downPaymentPercent)) return 0
  return propertyPrice * (downPaymentPercent / 100)
}

export function calcDownPaymentAmountFromInput(
  propertyPrice: number,
  mode: DownPaymentMode,
  value: number,
): number {
  if (!Number.isFinite(value) || value < 0) return 0

  if (mode === 'amount') return value

  return calcDownPaymentAmount(propertyPrice, value)
}

export function calcDownPaymentPercentFromAmount(
  propertyPrice: number,
  downPaymentAmount: number,
): number {
  if (!Number.isFinite(propertyPrice) || propertyPrice <= 0) return 0
  if (!Number.isFinite(downPaymentAmount) || downPaymentAmount <= 0) return 0
  return (downPaymentAmount / propertyPrice) * 100
}

export function calcPrincipal(
  propertyPrice: number,
  downPaymentPercent: number,
): number {
  const down = calcDownPaymentAmount(propertyPrice, downPaymentPercent)
  const principal = propertyPrice - down
  return principal > 0 ? principal : 0
}

export function calcPrincipalFromDownPaymentAmount(
  propertyPrice: number,
  downPaymentAmount: number,
): number {
  if (!Number.isFinite(propertyPrice) || propertyPrice <= 0) return 0
  if (!Number.isFinite(downPaymentAmount) || downPaymentAmount < 0) return 0
  const principal = propertyPrice - downPaymentAmount
  return principal > 0 ? principal : 0
}

export function calcMonthlyRate(annualRatePercent: number): number {
  if (!Number.isFinite(annualRatePercent) || annualRatePercent < 0) return 0
  return annualRatePercent / 100 / 12
}

export function calcAnnuityMonthlyPayment(
  principal: number,
  annualRatePercent: number,
  months: number,
): number {
  if (!Number.isFinite(principal) || principal <= 0) return 0
  if (!Number.isFinite(months) || months <= 0) return 0
  const i = calcMonthlyRate(annualRatePercent)
  if (i === 0) return principal / months

  const pow = Math.pow(1 + i, months)
  return (principal * (i * pow)) / (pow - 1)
}

export function calcAnnuityTotals(
  principal: number,
  annualRatePercent: number,
  months: number,
): { monthlyPayment: number; totalPayment: number; overpayment: number } {
  const monthlyPayment = calcAnnuityMonthlyPayment(
    principal,
    annualRatePercent,
    months,
  )
  const totalPayment = monthlyPayment * months
  const overpayment = totalPayment - principal
  return { monthlyPayment, totalPayment, overpayment }
}

export function calcDifferentiatedSchedule(
  principal: number,
  annualRatePercent: number,
  months: number,
): { schedule: DifferentiatedRow[]; totalPayment: number; overpayment: number } {
  if (!Number.isFinite(principal) || principal <= 0) {
    return { schedule: [], totalPayment: 0, overpayment: 0 }
  }
  if (!Number.isFinite(months) || months <= 0) {
    return { schedule: [], totalPayment: 0, overpayment: 0 }
  }

  const i = calcMonthlyRate(annualRatePercent)
  const principalPart = principal / months

  const schedule: DifferentiatedRow[] = []
  let totalPayment = 0

  for (let month = 1; month <= months; month += 1) {
    const balanceBefore = principal - principalPart * (month - 1)
    const interestPart = balanceBefore * i
    const payment = principalPart + interestPart
    const balanceAfter = Math.max(0, balanceBefore - principalPart)

    schedule.push({
      month,
      payment,
      principalPart,
      interestPart,
      balanceBefore,
      balanceAfter,
    })

    totalPayment += payment
  }

  const overpayment = totalPayment - principal
  return { schedule, totalPayment, overpayment }
}

export function simulateEarlyRepaymentAnnuity(
  principal: number,
  annualRatePercent: number,
  months: number,
  extraPayment: number,
): {
  baseMonthlyPayment: number
  schedule: EarlyRepaymentRow[]
  totalPayment: number
  totalInterest: number
  monthsActual: number
  balanceSeries: number[]
} {
  if (!Number.isFinite(principal) || principal <= 0) {
    return {
      baseMonthlyPayment: 0,
      schedule: [],
      totalPayment: 0,
      totalInterest: 0,
      monthsActual: 0,
      balanceSeries: [],
    }
  }
  if (!Number.isFinite(months) || months <= 0) {
    return {
      baseMonthlyPayment: 0,
      schedule: [],
      totalPayment: 0,
      totalInterest: 0,
      monthsActual: 0,
      balanceSeries: [],
    }
  }

  const i = calcMonthlyRate(annualRatePercent)
  const baseMonthlyPayment = calcAnnuityMonthlyPayment(
    principal,
    annualRatePercent,
    months,
  )
  const safeExtra = Number.isFinite(extraPayment) && extraPayment > 0 ? extraPayment : 0

  let balance = principal
  let month = 0
  let totalPayment = 0
  let totalInterest = 0
  const schedule: EarlyRepaymentRow[] = []
  const balanceSeries: number[] = []

  while (balance > 0 && month < 5000) {
    month += 1
    const interestPart = balance * i
    const principalPart = Math.max(0, baseMonthlyPayment - interestPart)
    const extraPaymentPart = Math.max(
      0,
      Math.min(safeExtra, Math.max(0, balance - principalPart)),
    )

    const payment = baseMonthlyPayment + extraPaymentPart
    balance = Math.max(0, balance - principalPart - extraPaymentPart)

    schedule.push({
      month,
      payment,
      interestPart,
      principalPart,
      extraPaymentPart,
      balanceAfter: balance,
    })

    totalPayment += payment
    totalInterest += interestPart
    balanceSeries.push(balance)
  }

  return {
    baseMonthlyPayment,
    schedule,
    totalPayment,
    totalInterest,
    monthsActual: month,
    balanceSeries,
  }
}

export function simulateEarlyRepaymentDifferentiated(
  principal: number,
  annualRatePercent: number,
  months: number,
  extraPayment: number,
): {
  basePrincipalPart: number
  schedule: EarlyRepaymentRow[]
  totalPayment: number
  totalInterest: number
  monthsActual: number
  balanceSeries: number[]
} {
  if (!Number.isFinite(principal) || principal <= 0) {
    return {
      basePrincipalPart: 0,
      schedule: [],
      totalPayment: 0,
      totalInterest: 0,
      monthsActual: 0,
      balanceSeries: [],
    }
  }
  if (!Number.isFinite(months) || months <= 0) {
    return {
      basePrincipalPart: 0,
      schedule: [],
      totalPayment: 0,
      totalInterest: 0,
      monthsActual: 0,
      balanceSeries: [],
    }
  }

  const i = calcMonthlyRate(annualRatePercent)
  const basePrincipalPart = principal / months
  const safeExtra = Number.isFinite(extraPayment) && extraPayment > 0 ? extraPayment : 0

  let balance = principal
  let month = 0
  let totalPayment = 0
  let totalInterest = 0
  const schedule: EarlyRepaymentRow[] = []
  const balanceSeries: number[] = []

  while (balance > 0 && month < 5000) {
    month += 1
    const interestPart = balance * i
    const principalPart = Math.min(basePrincipalPart, balance)
    const extraPaymentPart = Math.max(
      0,
      Math.min(safeExtra, Math.max(0, balance - principalPart)),
    )

    const payment = principalPart + interestPart + extraPaymentPart
    balance = Math.max(0, balance - principalPart - extraPaymentPart)

    schedule.push({
      month,
      payment,
      interestPart,
      principalPart,
      extraPaymentPart,
      balanceAfter: balance,
    })

    totalPayment += payment
    totalInterest += interestPart
    balanceSeries.push(balance)
  }

  return {
    basePrincipalPart,
    schedule,
    totalPayment,
    totalInterest,
    monthsActual: month,
    balanceSeries,
  }
}

export function simulatePayReductionAnnuity(
  principal: number,
  annualRatePercent: number,
  months: number,
  extraPayment: number,
): {
  schedule: EarlyRepaymentRow[]
  totalPayment: number
  totalInterest: number
} {
  if (!Number.isFinite(principal) || principal <= 0) {
    return { schedule: [], totalPayment: 0, totalInterest: 0 }
  }
  if (!Number.isFinite(months) || months <= 0) {
    return { schedule: [], totalPayment: 0, totalInterest: 0 }
  }

  const i = calcMonthlyRate(annualRatePercent)
  const safeExtra = Number.isFinite(extraPayment) && extraPayment > 0 ? extraPayment : 0

  let balance = principal
  let totalPayment = 0
  let totalInterest = 0
  const schedule: EarlyRepaymentRow[] = []

  for (let month = 1; month <= months; month += 1) {
    const monthsLeft = months - month + 1

    if (balance <= 0) {
      schedule.push({
        month,
        payment: 0,
        interestPart: 0,
        principalPart: 0,
        extraPaymentPart: 0,
        balanceAfter: 0,
      })
      continue
    }

    const payment = calcAnnuityMonthlyPayment(balance, annualRatePercent, monthsLeft)
    const interestPart = balance * i
    const principalPart = Math.max(0, payment - interestPart)
    const extraPaymentPart = Math.max(
      0,
      Math.min(safeExtra, Math.max(0, balance - principalPart)),
    )

    balance = Math.max(0, balance - principalPart - extraPaymentPart)

    schedule.push({
      month,
      payment,
      interestPart,
      principalPart,
      extraPaymentPart,
      balanceAfter: balance,
    })

    totalPayment += payment + extraPaymentPart
    totalInterest += interestPart
  }

  return { schedule, totalPayment, totalInterest }
}

export function simulatePayReductionDifferentiated(
  principal: number,
  annualRatePercent: number,
  months: number,
  extraPayment: number,
): {
  schedule: EarlyRepaymentRow[]
  totalPayment: number
  totalInterest: number
} {
  if (!Number.isFinite(principal) || principal <= 0) {
    return { schedule: [], totalPayment: 0, totalInterest: 0 }
  }
  if (!Number.isFinite(months) || months <= 0) {
    return { schedule: [], totalPayment: 0, totalInterest: 0 }
  }

  const i = calcMonthlyRate(annualRatePercent)
  const safeExtra = Number.isFinite(extraPayment) && extraPayment > 0 ? extraPayment : 0

  let balance = principal
  let totalPayment = 0
  let totalInterest = 0
  const schedule: EarlyRepaymentRow[] = []

  for (let month = 1; month <= months; month += 1) {
    const monthsLeft = months - month + 1

    if (balance <= 0) {
      schedule.push({
        month,
        payment: 0,
        interestPart: 0,
        principalPart: 0,
        extraPaymentPart: 0,
        balanceAfter: 0,
      })
      continue
    }

    const principalPart = balance / monthsLeft
    const interestPart = balance * i
    const payment = principalPart + interestPart
    const extraPaymentPart = Math.max(
      0,
      Math.min(safeExtra, Math.max(0, balance - principalPart)),
    )

    balance = Math.max(0, balance - principalPart - extraPaymentPart)

    schedule.push({
      month,
      payment,
      interestPart,
      principalPart,
      extraPaymentPart,
      balanceAfter: balance,
    })

    totalPayment += payment + extraPaymentPart
    totalInterest += interestPart
  }

  return { schedule, totalPayment, totalInterest }
}

export function downsampleSeries(
  series: number[],
  maxPoints: number,
): { x: number; y: number }[] {
  if (series.length === 0) return []
  if (series.length <= maxPoints) {
    return series.map((y, idx) => ({ x: idx + 1, y }))
  }

  const step = Math.ceil(series.length / maxPoints)
  const points: { x: number; y: number }[] = []
  for (let i = 0; i < series.length; i += step) {
    points.push({ x: i + 1, y: series[i] ?? 0 })
  }

  const lastIdx = series.length - 1
  if (points[points.length - 1]?.x !== lastIdx + 1) {
    points.push({ x: lastIdx + 1, y: series[lastIdx] ?? 0 })
  }

  return points
}
