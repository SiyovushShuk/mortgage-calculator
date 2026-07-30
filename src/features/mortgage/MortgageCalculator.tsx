import { useMemo, useRef, useState, type ChangeEvent, type RefObject } from 'react'
import FormulasHelp from './FormulasHelp'
import PaymentChart from './PaymentChart'
import {
  calcAnnuitySchedule,
  calcAnnuityMonthlyPayment,
  calcDifferentiatedSchedule,
  calcDownPaymentAmountFromInput,
  calcDownPaymentPercentFromAmount,
  calcMonthlyRate,
  calcPrincipalFromDownPaymentAmount,
  DownPaymentMode,
  DifferentiatedRow,
  EarlyRepaymentRow,
  PaymentType,
  simulateEarlyRepaymentAnnuity,
  simulateEarlyRepaymentDifferentiated,
  simulatePayReduction,
  TermUnit,
  toMonths,
} from './calc'
import { formatCurrency, formatNumber, formatPercent } from './format'
import { CURRENCY_SYMBOLS, type CurrencySymbol, useCurrency } from './currency'

type FieldError = string | null

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function parseLocalizedNumber(value: string): number {
  const normalized = value.replace(/\s/g, '').replace(',', '.')
  if (normalized === '') return Number.NaN
  const num = Number(normalized)
  if (!Number.isFinite(num)) return Number.NaN
  return num
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

function formatDigits(value: string): string {
  if (value === '') return ''
  return formatNumber(Number(value))
}

function setCursorByDigits(
  input: HTMLInputElement,
  digitsBeforeCursor: number,
): void {
  if (digitsBeforeCursor <= 0) {
    input.setSelectionRange(0, 0)
    return
  }

  const formatted = input.value
  let digitsSeen = 0
  let newPos = formatted.length

  for (let i = 0; i < formatted.length; i += 1) {
    if (/\d/.test(formatted[i] ?? '')) digitsSeen += 1
    if (digitsSeen >= digitsBeforeCursor) {
      newPos = i + 1
      break
    }
  }

  input.setSelectionRange(newPos, newPos)
}

function pluralRu(value: number, one: string, few: string, many: string): string {
  const mod10 = value % 10
  const mod100 = value % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}

function formatTermMonths(totalMonths: number): string {
  const safe = Math.max(0, Math.round(totalMonths))
  const years = Math.floor(safe / 12)
  const months = safe % 12

  const parts: string[] = []
  if (years > 0) parts.push(`${years} ${pluralRu(years, 'год', 'года', 'лет')}`)
  if (months > 0 || parts.length === 0) {
    parts.push(`${months} ${pluralRu(months, 'месяц', 'месяца', 'месяцев')}`)
  }
  return parts.join(' ')
}

function calcRequiredIncome(
  payment: number,
  otherPayments: number,
  pdnThresholdPercent: number,
): number {
  if (!Number.isFinite(payment) || payment < 0) return Number.NaN
  if (!Number.isFinite(otherPayments) || otherPayments < 0) return Number.NaN
  if (!Number.isFinite(pdnThresholdPercent) || pdnThresholdPercent <= 0) return Number.NaN
  return (payment + otherPayments) / (pdnThresholdPercent / 100)
}

export default function MortgageCalculator() {
  const { currencySymbol, setCurrencySymbol } = useCurrency()

  const propertyPriceRef = useRef<HTMLInputElement>(null)
  const downPaymentAmountRef = useRef<HTMLInputElement>(null)
  const otherMonthlyPaymentsRef = useRef<HTMLInputElement>(null)
  const extraPaymentTermRef = useRef<HTMLInputElement>(null)
  const extraPaymentPayRef = useRef<HTMLInputElement>(null)

  const [propertyPriceDigits, setPropertyPriceDigits] = useState('20000000')
  const [propertyPrice, setPropertyPrice] = useState(20_000_000)
  const [downPaymentMode, setDownPaymentMode] = useState<DownPaymentMode>('percent')
  const [downPaymentValue, setDownPaymentValue] = useState(20)
  const [downPaymentPercentText, setDownPaymentPercentText] = useState('20')
  const [downPaymentAmountDigits, setDownPaymentAmountDigits] = useState('4000000')
  const [annualRatePercent, setAnnualRatePercent] = useState(12)
  const [annualRateText, setAnnualRateText] = useState('12')
  const [pdnThresholdPercent, setPdnThresholdPercent] = useState(50)
  const [pdnThresholdText, setPdnThresholdText] = useState('50')
  const [otherMonthlyPaymentsDigits, setOtherMonthlyPaymentsDigits] = useState('0')
  const [termValue, setTermValue] = useState(20)
  const [termUnit, setTermUnit] = useState<TermUnit>('years')
  const [paymentType, setPaymentType] = useState<PaymentType>('annuity')
  const [activeTab, setActiveTab] = useState<'base' | 'term' | 'pay'>('base')
  const [extraPaymentTermDigits, setExtraPaymentTermDigits] = useState('20000')
  const [extraPaymentPayDigits, setExtraPaymentPayDigits] = useState('20000')

  const [calcInput, setCalcInput] = useState<{
    propertyPrice: number
    downPaymentMode: DownPaymentMode
    downPaymentValue: number
    annualRatePercent: number
    pdnThresholdPercent: number
    otherMonthlyPayments: number
    termValue: number
    termUnit: TermUnit
    paymentType: PaymentType
  } | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  const [prepayTermCalcInput, setPrepayTermCalcInput] = useState<{
    propertyPrice: number
    downPaymentMode: DownPaymentMode
    downPaymentValue: number
    annualRatePercent: number
    pdnThresholdPercent: number
    otherMonthlyPayments: number
    termValue: number
    termUnit: TermUnit
    paymentType: PaymentType
    extraPayment: number
  } | null>(null)
  const [isPrepayTermDirty, setIsPrepayTermDirty] = useState(false)

  const [prepayPayCalcInput, setPrepayPayCalcInput] = useState<{
    propertyPrice: number
    downPaymentMode: DownPaymentMode
    downPaymentValue: number
    annualRatePercent: number
    pdnThresholdPercent: number
    otherMonthlyPayments: number
    termValue: number
    termUnit: TermUnit
    paymentType: PaymentType
    extraPayment: number
  } | null>(null)
  const [isPrepayPayDirty, setIsPrepayPayDirty] = useState(false)

  const months = useMemo(() => toMonths(termValue, termUnit), [termValue, termUnit])
  const otherMonthlyPayments = useMemo(() => {
    if (otherMonthlyPaymentsDigits === '') return 0
    const num = Number(otherMonthlyPaymentsDigits)
    return Number.isFinite(num) && num >= 0 ? num : 0
  }, [otherMonthlyPaymentsDigits])
  const extraPaymentTerm = useMemo(() => {
    if (extraPaymentTermDigits === '') return 0
    const num = Number(extraPaymentTermDigits)
    return Number.isFinite(num) && num >= 0 ? num : 0
  }, [extraPaymentTermDigits])

  const extraPaymentPay = useMemo(() => {
    if (extraPaymentPayDigits === '') return 0
    const num = Number(extraPaymentPayDigits)
    return Number.isFinite(num) && num >= 0 ? num : 0
  }, [extraPaymentPayDigits])

  const setTermUnitWithConversion = (next: TermUnit) => {
    if (next === termUnit) return
    setIsDirty(true)
    setIsPrepayTermDirty(true)
    setIsPrepayPayDirty(true)
    if (!Number.isFinite(termValue) || termValue <= 0) {
      setTermUnit(next)
      return
    }

    if (termUnit === 'years' && next === 'months') {
      setTermValue(Math.round(termValue * 12))
      setTermUnit(next)
      return
    }

    if (termUnit === 'months' && next === 'years') {
      setTermValue(Math.max(1, Math.round(termValue / 12)))
      setTermUnit(next)
      return
    }

    setTermUnit(next)
  }

  const setDownPaymentModeWithConversion = (next: DownPaymentMode) => {
    if (next === downPaymentMode) return
    setIsDirty(true)
    setIsPrepayTermDirty(true)
    setIsPrepayPayDirty(true)

    if (next === 'amount' && downPaymentMode === 'percent') {
      const amount = calcDownPaymentAmountFromInput(
        propertyPrice,
        'percent',
        downPaymentValue,
      )
      setDownPaymentValue(Math.round(amount))
      const nextDigits = String(Math.round(amount))
      setDownPaymentAmountDigits(nextDigits)
      setDownPaymentMode(next)
      return
    }

    if (next === 'percent' && downPaymentMode === 'amount') {
      const percent = calcDownPaymentPercentFromAmount(propertyPrice, downPaymentValue)
      const safePercent = Number(percent.toFixed(2))
      setDownPaymentValue(safePercent)
      setDownPaymentPercentText(formatNumber(safePercent))
      setDownPaymentMode(next)
      return
    }

    setDownPaymentMode(next)
  }

  const errors = useMemo(() => {
    const result: {
      propertyPrice: FieldError
      downPayment: FieldError
      annualRatePercent: FieldError
      pdnThresholdPercent: FieldError
      otherMonthlyPayments: FieldError
      termValue: FieldError
    } = {
      propertyPrice: null,
      downPayment: null,
      annualRatePercent: null,
      pdnThresholdPercent: null,
      otherMonthlyPayments: null,
      termValue: null,
    }

    if (!Number.isFinite(propertyPrice) || propertyPrice <= 0) {
      result.propertyPrice = 'Введите положительную сумму'
    }

    if (downPaymentMode === 'percent') {
      if (
        !Number.isFinite(downPaymentValue) ||
        downPaymentValue < 0 ||
        downPaymentValue > 100
      ) {
        result.downPayment = 'Должно быть от 0 до 100%'
      }
    } else {
      if (!Number.isFinite(downPaymentValue) || downPaymentValue < 0) {
        result.downPayment = 'Введите неотрицательную сумму'
      } else if (!Number.isFinite(propertyPrice) || propertyPrice <= 0) {
        result.downPayment = 'Сначала введите сумму ипотеки'
      } else if (downPaymentValue >= propertyPrice) {
        result.downPayment = 'Взнос должен быть меньше стоимости жилья'
      }
    }

    if (!Number.isFinite(annualRatePercent) || annualRatePercent < 0) {
      result.annualRatePercent = 'Введите ставку'
    } else if (annualRatePercent <= 0) {
      result.annualRatePercent = 'Ставка должна быть больше 0'
    } else if (annualRatePercent > 50) {
      result.annualRatePercent = 'Разумные границы: до 50%'
    }

    if (!Number.isFinite(pdnThresholdPercent) || pdnThresholdPercent <= 0) {
      result.pdnThresholdPercent = 'Введите порог'
    } else if (pdnThresholdPercent < 1 || pdnThresholdPercent > 100) {
      result.pdnThresholdPercent = 'Должно быть от 1 до 100%'
    }

    if (!Number.isFinite(otherMonthlyPayments) || otherMonthlyPayments < 0) {
      result.otherMonthlyPayments = 'Введите неотрицательную сумму'
    }

    if (!Number.isFinite(termValue) || termValue <= 0) {
      result.termValue = 'Срок должен быть больше 0'
    } else if (!Number.isInteger(termValue)) {
      result.termValue = 'Срок должен быть целым числом'
    } else if (termUnit === 'years' && (termValue < 1 || termValue > 50)) {
      result.termValue = 'Разумные границы: 1–50 лет'
    } else if (termUnit === 'months' && (termValue < 1 || termValue > 600)) {
      result.termValue = 'Разумные границы: 1–600 месяцев'
    }

    return result
  }, [
    annualRatePercent,
    downPaymentMode,
    downPaymentValue,
    otherMonthlyPayments,
    pdnThresholdPercent,
    propertyPrice,
    termUnit,
    termValue,
  ])

  const downPaymentAmount = useMemo(
    () =>
      calcDownPaymentAmountFromInput(
        propertyPrice,
        downPaymentMode,
        downPaymentMode === 'percent' ? clamp(downPaymentValue, 0, 100) : downPaymentValue,
      ),
    [downPaymentMode, downPaymentValue, propertyPrice],
  )

  const principal = useMemo(
    () => calcPrincipalFromDownPaymentAmount(propertyPrice, downPaymentAmount),
    [downPaymentAmount, propertyPrice],
  )

  const downPaymentPercent = useMemo(() => {
    if (downPaymentMode === 'percent') return downPaymentValue
    return calcDownPaymentPercentFromAmount(propertyPrice, downPaymentAmount)
  }, [downPaymentAmount, downPaymentMode, downPaymentValue, propertyPrice])

  const calculated = useMemo(() => {
    if (!calcInput) {
      return {
        months: 0,
        downPaymentAmount: 0,
        principal: 0,
        annuity: { monthlyPayment: 0, schedule: [], totalPayment: 0, overpayment: 0 },
        differentiated: { schedule: [], totalPayment: 0, overpayment: 0 },
      }
    }

    const months = toMonths(calcInput.termValue, calcInput.termUnit)
    const downPaymentAmount = calcDownPaymentAmountFromInput(
      calcInput.propertyPrice,
      calcInput.downPaymentMode,
      calcInput.downPaymentMode === 'percent'
        ? clamp(calcInput.downPaymentValue, 0, 100)
        : calcInput.downPaymentValue,
    )
    const principal = calcPrincipalFromDownPaymentAmount(
      calcInput.propertyPrice,
      downPaymentAmount,
    )

    if (calcInput.paymentType === 'annuity') {
      const monthlyPayment = calcAnnuityMonthlyPayment(
        principal,
        calcInput.annualRatePercent,
        months,
      )
      const annuity = calcAnnuitySchedule(principal, calcInput.annualRatePercent, months)
      return {
        months,
        downPaymentAmount,
        principal,
        annuity: { monthlyPayment, ...annuity },
        differentiated: { schedule: [], totalPayment: 0, overpayment: 0 },
      }
    }

    return {
      months,
      downPaymentAmount,
      principal,
      annuity: { monthlyPayment: 0, schedule: [], totalPayment: 0, overpayment: 0 },
      differentiated: calcDifferentiatedSchedule(
        principal,
        calcInput.annualRatePercent,
        months,
      ),
    }
  }, [calcInput])

  const chartSeries = useMemo(() => {
    if (!calcInput) return []
    if (calculated.months <= 0 || calculated.principal <= 0) return []

    if (calcInput.paymentType === 'annuity') {
      return [
        {
          label: 'Аннуитет',
          values: calculated.annuity.schedule.map((r) => r.payment),
          color: '#7dd3fc',
        },
      ]
    }

    return [
      {
        label: 'Дифференцированный',
        values: calculated.differentiated.schedule.map(
          (r: DifferentiatedRow) => r.payment,
        ),
        color: '#a78bfa',
      },
    ]
  }, [calcInput, calculated.annuity.monthlyPayment, calculated.differentiated.schedule, calculated.months, calculated.principal])

  const diffFirst = calculated.differentiated.schedule[0]?.payment ?? 0
  const diffLast =
    calculated.differentiated.schedule[
      calculated.differentiated.schedule.length - 1
    ]?.payment ?? 0

  const hasBlockingErrors = Object.values(errors).some(Boolean)
  const canCalculate =
    !hasBlockingErrors && Number.isFinite(propertyPrice) && propertyPrice > 0

  const basePaymentInfo = useMemo(() => {
    if (!canCalculate || principal <= 0 || months <= 0) return null
    if (paymentType === 'annuity') {
      return {
        type: 'annuity' as const,
        monthlyPayment: calcAnnuityMonthlyPayment(principal, annualRatePercent, months),
      }
    }

    const i = calcMonthlyRate(annualRatePercent)
    const principalPart = principal / months
    return {
      type: 'differentiated' as const,
      first: principalPart + principal * i,
      last: principalPart + principalPart * i,
    }
  }, [annualRatePercent, canCalculate, months, paymentType, principal])

  const formatCur = useMemo(
    () => (amount: number) => formatCurrency(amount, currencySymbol),
    [currencySymbol],
  )

  const requiredIncome = useMemo(() => {
    if (!calcInput) return Number.NaN
    const paymentForCalc =
      calcInput.paymentType === 'annuity' ? calculated.annuity.monthlyPayment : diffFirst
    return calcRequiredIncome(
      paymentForCalc,
      calcInput.otherMonthlyPayments,
      calcInput.pdnThresholdPercent,
    )
  }, [
    calcInput,
    calculated.annuity.monthlyPayment,
    diffFirst,
  ])

  const requiredIncomeHint = useMemo(() => {
    if (!calcInput) return ''
    return `(при ПДН ≤ ${formatPercent(calcInput.pdnThresholdPercent)} и др. платежах ${formatCur(calcInput.otherMonthlyPayments)})`
  }, [calcInput, formatCur])

  return (
    <div className="calculator">
      <FormulasHelp />
      <section className="panel">
        <div className="panelHeader">
          <div className="panelTitle">Параметры</div>
          <label className="currencyPicker" title="Меняет только значок, расчёты те же">
            <span className="currencyPickerLabel">Знак валюты</span>
            <select
              className="currencyPickerSelect"
              value={currencySymbol}
              onChange={(e) => setCurrencySymbol(e.target.value as CurrencySymbol)}
            >
              {CURRENCY_SYMBOLS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="formGrid">
          <label className="field">
            <div className="fieldLabel">Сумма ипотеки (стоимость жилья)</div>
            <input
              className="fieldInput"
              inputMode="numeric"
              type="text"
              ref={propertyPriceRef}
              value={formatDigits(propertyPriceDigits)}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const input = e.target
                const cursor = input.selectionStart ?? input.value.length
                const digitsBeforeCursor = digitsOnly(input.value.slice(0, cursor)).length
                const nextDigits = digitsOnly(input.value)

                setPropertyPriceDigits(nextDigits)
                setPropertyPrice(nextDigits === '' ? Number.NaN : Number(nextDigits))
                setIsDirty(true)
                setIsPrepayTermDirty(true)
                setIsPrepayPayDirty(true)

                requestAnimationFrame(() => {
                  const el = propertyPriceRef.current
                  if (!el) return
                  setCursorByDigits(el, Math.min(digitsBeforeCursor, nextDigits.length))
                })
              }}
            />
            {errors.propertyPrice && (
              <div className="fieldError">{errors.propertyPrice}</div>
            )}
          </label>

          <label className="field">
            <div className="fieldLabel">Первоначальный взнос</div>
            <div className="segmented">
              <button
                className={downPaymentMode === 'percent' ? 'segmentedBtn active' : 'segmentedBtn'}
                type="button"
                onClick={() => setDownPaymentModeWithConversion('percent')}
              >
                %
              </button>
              <button
                className={downPaymentMode === 'amount' ? 'segmentedBtn active' : 'segmentedBtn'}
                type="button"
                onClick={() => setDownPaymentModeWithConversion('amount')}
              >
                {currencySymbol}
              </button>
            </div>
            <input
              className="fieldInput"
              inputMode={downPaymentMode === 'percent' ? 'decimal' : 'numeric'}
              type="text"
              ref={downPaymentMode === 'amount' ? downPaymentAmountRef : undefined}
              value={
                downPaymentMode === 'percent'
                  ? downPaymentPercentText
                  : formatDigits(downPaymentAmountDigits)
              }
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                if (downPaymentMode === 'percent') {
                  const nextText = e.target.value
                  setDownPaymentPercentText(nextText)
                  setDownPaymentValue(parseLocalizedNumber(nextText))
                  setIsDirty(true)
                  setIsPrepayTermDirty(true)
                  setIsPrepayPayDirty(true)
                  return
                }

                const input = e.target
                const cursor = input.selectionStart ?? input.value.length
                const digitsBeforeCursor = digitsOnly(input.value.slice(0, cursor)).length
                const nextDigits = digitsOnly(input.value)

                setDownPaymentAmountDigits(nextDigits)
                setDownPaymentValue(nextDigits === '' ? Number.NaN : Number(nextDigits))
                setIsDirty(true)
                setIsPrepayTermDirty(true)
                setIsPrepayPayDirty(true)

                requestAnimationFrame(() => {
                  const el = downPaymentAmountRef.current
                  if (!el) return
                  setCursorByDigits(el, Math.min(digitsBeforeCursor, nextDigits.length))
                })
              }}
              onBlur={() => {
                if (downPaymentMode !== 'percent') return
                if (!Number.isFinite(downPaymentValue)) {
                  setDownPaymentPercentText('')
                  return
                }
                setDownPaymentPercentText(formatNumber(downPaymentValue))
              }}
            />
            <div className="fieldHint">
              {downPaymentMode === 'percent'
                ? `${formatCur(downPaymentAmount)}`
                : `${formatNumber(downPaymentPercent)}%`}
            </div>
            {errors.downPayment && (
              <div className="fieldError">{errors.downPayment}</div>
            )}
          </label>

          <label className="field">
            <div className="fieldLabel">Процентная ставка, % годовых</div>
            <input
              className="fieldInput"
              inputMode="decimal"
              type="text"
              value={annualRateText}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const nextText = e.target.value
                setAnnualRateText(nextText)
                setAnnualRatePercent(parseLocalizedNumber(nextText))
                setIsDirty(true)
                setIsPrepayTermDirty(true)
                setIsPrepayPayDirty(true)
              }}
              onFocus={() => {
                if (Number.isFinite(annualRatePercent)) {
                  setAnnualRateText(String(annualRatePercent))
                }
              }}
              onBlur={() => {
                if (Number.isFinite(annualRatePercent)) {
                  setAnnualRateText(formatPercent(annualRatePercent))
                } else {
                  setAnnualRateText('')
                }
              }}
            />
            {errors.annualRatePercent && (
              <div className="fieldError">{errors.annualRatePercent}</div>
            )}
          </label>

          <label className="field">
            <div className="fieldLabel">Порог ПДН, %</div>
            <input
              className="fieldInput"
              inputMode="decimal"
              type="text"
              value={pdnThresholdText}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const nextText = e.target.value
                setPdnThresholdText(nextText)
                setPdnThresholdPercent(parseLocalizedNumber(nextText))
                setIsDirty(true)
                setIsPrepayTermDirty(true)
                setIsPrepayPayDirty(true)
              }}
              onFocus={() => {
                if (Number.isFinite(pdnThresholdPercent)) {
                  setPdnThresholdText(String(pdnThresholdPercent))
                }
              }}
              onBlur={() => {
                if (Number.isFinite(pdnThresholdPercent)) {
                  setPdnThresholdText(formatPercent(pdnThresholdPercent))
                } else {
                  setPdnThresholdText('')
                }
              }}
            />
            {errors.pdnThresholdPercent && (
              <div className="fieldError">{errors.pdnThresholdPercent}</div>
            )}
          </label>

          <label className="field">
            <div className="fieldLabel">{`Другие ежемесячные платежи, ${currencySymbol}`}</div>
            <input
              className="fieldInput"
              inputMode="numeric"
              type="text"
              ref={otherMonthlyPaymentsRef}
              value={formatDigits(otherMonthlyPaymentsDigits)}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const input = e.target
                const cursor = input.selectionStart ?? input.value.length
                const digitsBeforeCursor = digitsOnly(input.value.slice(0, cursor)).length
                const nextDigits = digitsOnly(input.value)

                setOtherMonthlyPaymentsDigits(nextDigits)
                setIsDirty(true)
                setIsPrepayTermDirty(true)
                setIsPrepayPayDirty(true)

                requestAnimationFrame(() => {
                  const el = otherMonthlyPaymentsRef.current
                  if (!el) return
                  setCursorByDigits(el, Math.min(digitsBeforeCursor, nextDigits.length))
                })
              }}
            />
            {errors.otherMonthlyPayments && (
              <div className="fieldError">{errors.otherMonthlyPayments}</div>
            )}
          </label>

          <div className="field">
            <div className="fieldLabel">Срок кредита</div>
            <div className="segmented">
              <button
                className={termUnit === 'years' ? 'segmentedBtn active' : 'segmentedBtn'}
                type="button"
                onClick={() => setTermUnitWithConversion('years')}
              >
                Годы
              </button>
              <button
                className={termUnit === 'months' ? 'segmentedBtn active' : 'segmentedBtn'}
                type="button"
                onClick={() => setTermUnitWithConversion('months')}
              >
                Месяцы
              </button>
            </div>
            <input
              className="fieldInput"
              type="number"
              min={1}
              step={1}
              value={termValue}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setTermValue(Number(e.target.value))
                setIsDirty(true)
                setIsPrepayTermDirty(true)
                setIsPrepayPayDirty(true)
              }}
            />
            {errors.termValue && <div className="fieldError">{errors.termValue}</div>}
          </div>

          <div className="field">
            <div className="fieldLabel">Тип платежа</div>
            <div className="segmented segmentedPaymentType">
              <button
                className={paymentType === 'annuity' ? 'segmentedBtn active' : 'segmentedBtn'}
                type="button"
                onClick={() => {
                  setPaymentType('annuity')
                  setIsDirty(true)
                  setIsPrepayTermDirty(true)
                  setIsPrepayPayDirty(true)
                }}
              >
                Аннуитет
              </button>
              <button
                className={
                  paymentType === 'differentiated'
                    ? 'segmentedBtn active'
                    : 'segmentedBtn'
                }
                type="button"
                onClick={() => {
                  setPaymentType('differentiated')
                  setIsDirty(true)
                  setIsPrepayTermDirty(true)
                  setIsPrepayPayDirty(true)
                }}
              >
                <span className="paymentTypeLabelLong">Дифференцированный</span>
                <span className="paymentTypeLabelShort">Дифф.</span>
              </button>
            </div>
            <div className="fieldHint">{months > 0 ? `${months} мес.` : '—'}</div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panelTitle">Сценарий</div>
        <div className="segmented segmented3 segmentedScroll">
          <button
            className={activeTab === 'base' ? 'segmentedBtn active' : 'segmentedBtn'}
            type="button"
            onClick={() => setActiveTab('base')}
          >
            Без доп. платежей
          </button>
          <button
            className={activeTab === 'term' ? 'segmentedBtn active' : 'segmentedBtn'}
            type="button"
            onClick={() => setActiveTab('term')}
            title="Досрочное погашение с уменьшением срока кредита"
          >
            <span className="tabLabelLong">Досрочное погашение с уменьшением срока кредита</span>
            <span className="tabLabelShort">Досрочное погашение</span>
          </button>
          <button
            className={activeTab === 'pay' ? 'segmentedBtn active' : 'segmentedBtn'}
            type="button"
            onClick={() => setActiveTab('pay')}
            title="Досрочное погашение с уменьшением платежа"
          >
            <span className="tabLabelLong">Досрочное погашение с уменьшением платежа</span>
            <span className="tabLabelShort">Уменьшение платежа</span>
          </button>
        </div>
      </section>

      {activeTab === 'base' ? (
        <>
          <section className="panel">
            <div className="formActions">
              <button
                className="primaryButton"
                type="button"
                disabled={!canCalculate}
                onClick={() => {
                  setCalcInput({
                    propertyPrice,
                    downPaymentMode,
                    downPaymentValue,
                    annualRatePercent,
                    pdnThresholdPercent,
                    otherMonthlyPayments,
                    termValue,
                    termUnit,
                    paymentType,
                  })
                  setIsDirty(false)
                }}
              >
                Посчитать
              </button>
              {calcInput && isDirty && (
                <div className="dirtyHint">
                  Данные изменены — нажмите «Посчитать» для обновления результата.
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panelTitle">Расчёт взноса и тела кредита</div>
            {!calcInput ? (
              <div className="emptyState">Нажмите «Посчитать», чтобы увидеть расчёт.</div>
            ) : (
              <div className="statsGrid">
                <div className="statCard">
                  <div className="statLabel">Первоначальный взнос</div>
                  <div className="statValue">{formatCur(calculated.downPaymentAmount)}</div>
                </div>
                <div className="statCard">
                  <div className="statLabel">Тело кредита (S)</div>
                  <div className="statValue">{formatCur(calculated.principal)}</div>
                </div>
              </div>
            )}
          </section>

          <section className="panel">
            <div className="panelTitle">Итоги</div>
            {!calcInput ? (
              <div className="emptyState">Введите параметры и нажмите «Посчитать».</div>
            ) : calcInput.paymentType === 'annuity' ? (
              <div className="resultCard">
                <div className="resultTitle">Аннуитет</div>
                <div className="paymentIncomeGrid">
                  <div className="primaryPayment">
                    <div className="primaryPaymentLabel">Ежемесячный платёж</div>
                    <div className="primaryPaymentValue">
                      {formatCur(calculated.annuity.monthlyPayment)}
                    </div>
                  </div>
                  <div className="primaryPayment">
                    <div className="primaryPaymentLabel">Необходимый доход</div>
                    <div className="primaryPaymentValue">
                      {Number.isFinite(requiredIncome) ? formatCur(requiredIncome) : '—'}
                    </div>
                    <div className="primaryPaymentSub">{requiredIncomeHint}</div>
                  </div>
                </div>
                <div className="resultRow">
                  <span>Итого выплат</span>
                  <span className="resultValue">
                    {formatCur(calculated.annuity.totalPayment)}
                  </span>
                </div>
                <div className="resultRow">
                  <span>Переплата по процентам</span>
                  <span className="resultValue">
                    {formatCur(calculated.annuity.overpayment)}
                  </span>
                </div>
                <div className="resultRow">
                  <span>Тело кредита</span>
                  <span className="resultValue">{formatCur(calculated.principal)}</span>
                </div>
              </div>
            ) : (
              <div className="resultCard">
                <div className="resultTitle">Дифференцированный</div>
                <div className="paymentIncomeGrid">
                  <div className="primaryPayment">
                    <div className="primaryPaymentLabel">Платёж в 1-м месяце</div>
                    <div className="primaryPaymentValue">{formatCur(diffFirst)}</div>
                  </div>
                  <div className="primaryPayment">
                    <div className="primaryPaymentLabel">Необходимый доход</div>
                    <div className="primaryPaymentValue">
                      {Number.isFinite(requiredIncome) ? formatCur(requiredIncome) : '—'}
                    </div>
                    <div className="primaryPaymentSub">{requiredIncomeHint}</div>
                  </div>
                </div>
                <div className="resultRow">
                  <span>Платёж в последний месяц</span>
                  <span className="resultValue">{formatCur(diffLast)}</span>
                </div>
                <div className="resultRow">
                  <span>Итого выплат</span>
                  <span className="resultValue">
                    {formatCur(calculated.differentiated.totalPayment)}
                  </span>
                </div>
                <div className="resultRow">
                  <span>Переплата по процентам</span>
                  <span className="resultValue">
                    {formatCur(calculated.differentiated.overpayment)}
                  </span>
                </div>
                <div className="resultRow">
                  <span>Тело кредита</span>
                  <span className="resultValue">{formatCur(calculated.principal)}</span>
                </div>
              </div>
            )}
          </section>

          <section className="panel">
            {!calcInput ? (
              <div className="emptyState">Нажмите «Посчитать», чтобы построить график.</div>
            ) : (
              <PaymentChart series={chartSeries} months={calculated.months} />
            )}
          </section>

          {calcInput && (
            <section className="panel">
              <div className="panelTitle">График платежей (таблица)</div>
              {(calcInput.paymentType === 'annuity'
                ? calculated.annuity.schedule
                : calculated.differentiated.schedule
              ).length === 0 ? (
                <div className="emptyState">Нет данных для построения таблицы.</div>
              ) : (
                <div className="tableWrap" role="region" aria-label="График платежей">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Месяц</th>
                        <th>Платёж</th>
                        <th>Тело</th>
                        <th>Проценты</th>
                        <th>Остаток до</th>
                        <th>Остаток после</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(calcInput.paymentType === 'annuity'
                        ? calculated.annuity.schedule
                        : calculated.differentiated.schedule
                      ).map((row) => (
                        <tr key={row.month}>
                          <td>{row.month}</td>
                          <td>{formatCur(row.payment)}</td>
                          <td>{formatCur(row.principalPart)}</td>
                          <td>{formatCur(row.interestPart)}</td>
                          <td>{formatCur(row.balanceBefore)}</td>
                          <td>{formatCur(row.balanceAfter)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      ) : activeTab === 'term' ? (
        <PrepaymentTermTab
          canCalculate={canCalculate}
          isDirty={isPrepayTermDirty}
          calcInput={prepayTermCalcInput}
          onCalculate={() => {
            setPrepayTermCalcInput({
              propertyPrice,
              downPaymentMode,
              downPaymentValue,
              annualRatePercent,
              pdnThresholdPercent,
              otherMonthlyPayments,
              termValue,
              termUnit,
              paymentType,
              extraPayment: extraPaymentTerm,
            })
            setIsPrepayTermDirty(false)
          }}
          extraPaymentDigits={extraPaymentTermDigits}
          extraPaymentRef={extraPaymentTermRef}
          setExtraPaymentDigits={setExtraPaymentTermDigits}
          setIsPrepayDirty={setIsPrepayTermDirty}
          formatTermMonths={formatTermMonths}
          basePaymentInfo={basePaymentInfo}
        />
      ) : (
        <PrepaymentPayTab
          canCalculate={canCalculate}
          isDirty={isPrepayPayDirty}
          calcInput={prepayPayCalcInput}
          onCalculate={() => {
            setPrepayPayCalcInput({
              propertyPrice,
              downPaymentMode,
              downPaymentValue,
              annualRatePercent,
              pdnThresholdPercent,
              otherMonthlyPayments,
              termValue,
              termUnit,
              paymentType,
              extraPayment: extraPaymentPay,
            })
            setIsPrepayPayDirty(false)
          }}
          extraPaymentDigits={extraPaymentPayDigits}
          extraPaymentRef={extraPaymentPayRef}
          setExtraPaymentDigits={setExtraPaymentPayDigits}
          setIsPrepayDirty={setIsPrepayPayDirty}
          formatTermMonths={formatTermMonths}
          basePaymentInfo={basePaymentInfo}
        />
      )}
    </div>
  )
}

type PrepaymentTermTabProps = {
  canCalculate: boolean
  isDirty: boolean
  calcInput: {
    propertyPrice: number
    downPaymentMode: DownPaymentMode
    downPaymentValue: number
    annualRatePercent: number
    pdnThresholdPercent: number
    otherMonthlyPayments: number
    termValue: number
    termUnit: TermUnit
    paymentType: PaymentType
    extraPayment: number
  } | null
  onCalculate: () => void
  extraPaymentDigits: string
  extraPaymentRef: RefObject<HTMLInputElement>
  setExtraPaymentDigits: (value: string) => void
  setIsPrepayDirty: (value: boolean) => void
  formatTermMonths: (months: number) => string
  basePaymentInfo:
    | { type: 'annuity'; monthlyPayment: number }
    | { type: 'differentiated'; first: number; last: number }
    | null
}

type CompareSummaryRow = {
  label: string
  base: string
  changed: string
}

function CompareSummary({
  changedLabel,
  rows,
}: {
  changedLabel: string
  rows: CompareSummaryRow[]
}) {
  return (
    <>
      <div className="compareGrid compareDesktop" role="table" aria-label="Сравнение">
        <div className="compareHead" role="row">
          <div role="columnheader" />
          <div role="columnheader">Без досрочного</div>
          <div role="columnheader">{changedLabel}</div>
        </div>

        {rows.map((row) => (
          <div className="compareRow" role="row" key={row.label}>
            <div className="compareKey" role="cell">
              {row.label}
            </div>
            <div role="cell">{row.base}</div>
            <div role="cell">{row.changed}</div>
          </div>
        ))}
      </div>

      <div className="compareMobile" aria-label="Сравнение">
        {rows.map((row) => (
          <div className="compareCard" key={row.label}>
            <div className="compareCardTitle">{row.label}</div>
            <div className="compareCardRow">
              <span className="compareCardKey">Без досрочного</span>
              <span className="compareCardValue">{row.base}</span>
            </div>
            <div className="compareCardRow">
              <span className="compareCardKey">{changedLabel}</span>
              <span className="compareCardValue">{row.changed}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function PrepaymentTermTab({
  canCalculate,
  isDirty,
  calcInput,
  onCalculate,
  extraPaymentDigits,
  extraPaymentRef,
  setExtraPaymentDigits,
  setIsPrepayDirty,
  formatTermMonths,
  basePaymentInfo,
}: PrepaymentTermTabProps) {
  const { currencySymbol } = useCurrency()
  const formatCur = useMemo(
    () => (amount: number) => formatCurrency(amount, currencySymbol),
    [currencySymbol],
  )

  const aggregateSchedule = useMemo(() => {
    return (rows: EarlyRepaymentRow[]) => {
      let totalPayment = 0
      let totalInterest = 0
      for (const r of rows) {
        totalPayment += r.payment
        totalInterest += r.interestPart
      }
      return { totalPayment, totalInterest, monthsActual: rows.length }
    }
  }, [])

  const extraPayment = extraPaymentDigits === '' ? 0 : Number(extraPaymentDigits)

  const computed = useMemo(() => {
    if (!calcInput) return null

    const months = toMonths(calcInput.termValue, calcInput.termUnit)
    const downPaymentAmount = calcDownPaymentAmountFromInput(
      calcInput.propertyPrice,
      calcInput.downPaymentMode,
      calcInput.downPaymentMode === 'percent'
        ? clamp(calcInput.downPaymentValue, 0, 100)
        : calcInput.downPaymentValue,
    )
    const principal = calcPrincipalFromDownPaymentAmount(
      calcInput.propertyPrice,
      downPaymentAmount,
    )
    const i = calcMonthlyRate(calcInput.annualRatePercent)
    const incomePayment =
      calcInput.paymentType === 'annuity'
        ? calcAnnuityMonthlyPayment(principal, calcInput.annualRatePercent, months)
        : principal / Math.max(1, months) + principal * i
    const requiredIncome = calcRequiredIncome(
      incomePayment,
      calcInput.otherMonthlyPayments,
      calcInput.pdnThresholdPercent,
    )

    if (calcInput.paymentType === 'annuity') {
      const base = simulateEarlyRepaymentAnnuity(
        principal,
        calcInput.annualRatePercent,
        months,
        0,
      )
      const withExtra = simulateEarlyRepaymentAnnuity(
        principal,
        calcInput.annualRatePercent,
        months,
        calcInput.extraPayment,
      )
      return { months, principal, base, withExtra, incomePayment, requiredIncome }
    }

    const base = simulateEarlyRepaymentDifferentiated(
      principal,
      calcInput.annualRatePercent,
      months,
      0,
    )
    const withExtra = simulateEarlyRepaymentDifferentiated(
      principal,
      calcInput.annualRatePercent,
      months,
      calcInput.extraPayment,
    )
    return { months, principal, base, withExtra, incomePayment, requiredIncome }
  }, [calcInput])

  const requiredIncomeHint = useMemo(() => {
    if (!calcInput) return ''
    return `(при ПДН ≤ ${formatPercent(calcInput.pdnThresholdPercent)} и др. платежах ${formatCur(calcInput.otherMonthlyPayments)})`
  }, [calcInput, formatCur])

  const baseTotals = useMemo(() => {
    if (!computed) return null
    return aggregateSchedule(computed.base.schedule as EarlyRepaymentRow[])
  }, [aggregateSchedule, computed])

  const withExtraTotals = useMemo(() => {
    if (!computed) return null
    return aggregateSchedule(computed.withExtra.schedule as EarlyRepaymentRow[])
  }, [aggregateSchedule, computed])

  const savings = useMemo(() => {
    if (!baseTotals || !withExtraTotals) return 0
    return baseTotals.totalInterest - withExtraTotals.totalInterest
  }, [baseTotals, withExtraTotals])

  const termReductionMonths = useMemo(() => {
    if (!computed || !withExtraTotals) return 0
    return Math.max(0, computed.months - withExtraTotals.monthsActual)
  }, [computed, withExtraTotals])

  const balanceSeries = useMemo(() => {
    if (!computed || !calcInput) return null
    const xMax = Math.max(computed.base.monthsActual, computed.withExtra.monthsActual, 1)
    return {
      xMax,
      series: [
        {
          label: 'Без досрочного',
          values: computed.base.balanceSeries,
          color: '#7dd3fc',
        },
        {
          label: `С доплатой ${formatCur(calcInput.extraPayment)}/мес`,
          values: computed.withExtra.balanceSeries,
          color: '#a78bfa',
        },
      ],
    }
  }, [calcInput, computed, formatCur])

  const schedule = useMemo(() => {
    if (!computed) return []
    return computed.withExtra.schedule as EarlyRepaymentRow[]
  }, [computed])

  const closesInFirstMonth = withExtraTotals?.monthsActual === 1

  return (
    <>
      <section className="panel">
        <div className="panelTitle">Досрочное погашение с уменьшением срока кредита</div>
        <div className="infoNote">
          Ежемесячный платёж остаётся прежним, но за счёт дополнительной суммы кредит
          будет полностью погашен раньше исходного срока.
        </div>

        <div className="prepayTopGrid">
          <div className="prepayLeft">
            <div className="prepayBase">
              <div className="prepayBaseTitle">Ваш текущий платёж</div>
              {!basePaymentInfo ? (
                <div className="prepayBaseValue">—</div>
              ) : basePaymentInfo.type === 'annuity' ? (
                <>
                  <div className="prepayBaseValue">
                    {formatCur(basePaymentInfo.monthlyPayment)}
                  </div>
                  <div className="prepayBaseHint">Аннуитетный платёж (одинаков каждый месяц)</div>
                </>
              ) : (
                <>
                  <div className="prepayBaseValue">
                    {formatCur(basePaymentInfo.first)} → {formatCur(basePaymentInfo.last)}
                  </div>
                  <div className="prepayBaseHint">1-й месяц → последний (дифференцированный)</div>
                </>
              )}
            </div>

            <div className="prepayBase prepayIncome">
              <div className="prepayBaseTitle">Необходимый доход</div>
              <div className="prepayBaseValue">
                {calcInput && computed && Number.isFinite(computed.requiredIncome)
                  ? formatCur(computed.requiredIncome)
                  : '—'}
              </div>
              <div className="prepayBaseHint">{requiredIncomeHint}</div>
            </div>
          </div>

          <div className="field">
            <div className="fieldLabel">{`Доп. платёж, ${currencySymbol}/мес`}</div>
            <input
              className="fieldInput"
              inputMode="numeric"
              type="text"
              ref={extraPaymentRef}
              value={formatDigits(extraPaymentDigits)}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const input = e.target
                const cursor = input.selectionStart ?? input.value.length
                const digitsBeforeCursor = digitsOnly(input.value.slice(0, cursor)).length
                const nextDigits = digitsOnly(input.value)

                setExtraPaymentDigits(nextDigits)
                setIsPrepayDirty(true)

                requestAnimationFrame(() => {
                  const el = extraPaymentRef.current
                  if (!el) return
                  setCursorByDigits(el, Math.min(digitsBeforeCursor, nextDigits.length))
                })
              }}
            />
            <div className="fieldHint">
              {extraPayment > 0
              ? `Каждый месяц +${formatCur(extraPayment)}`
              : `${formatCur(0)} — без доплаты`}
            </div>
          </div>
        </div>

        <div className="formActions">
          <button
            className="primaryButton"
            type="button"
            disabled={!canCalculate}
            onClick={onCalculate}
          >
            Посчитать
          </button>
          {calcInput && isDirty && (
            <div className="dirtyHint">
              Данные изменены — нажмите «Посчитать» для обновления результата.
            </div>
          )}
        </div>
      </section>

      {!calcInput ? (
        <section className="panel">
          <div className="emptyState">
            Задайте доплату и нажмите «Посчитать», чтобы увидеть эффект.
          </div>
        </section>
      ) : !computed || !baseTotals || !withExtraTotals ? null : (
        <>
          <section className="panel">
            <div className="panelTitle">Было / Стало</div>
            <CompareSummary
              changedLabel={`С досрочным (${formatCur(calcInput.extraPayment)}/мес)`}
              rows={[
                {
                  label: 'Срок кредита',
                  base: `${computed.months} мес`,
                  changed: `${withExtraTotals.monthsActual} мес`,
                },
                {
                  label: 'Переплата по процентам',
                  base: formatCur(baseTotals.totalInterest),
                  changed: formatCur(withExtraTotals.totalInterest),
                },
                {
                  label: 'Общая сумма выплат',
                  base: formatCur(baseTotals.totalPayment),
                  changed: formatCur(withExtraTotals.totalPayment),
                },
              ]}
            />
          </section>

          <section className="panel">
            <div className="megaGrid">
              <div className="megaCard">
                <div className="megaLabel">Срок сократится на</div>
                <div className="megaValue">{formatTermMonths(termReductionMonths)}</div>
                <div className="megaSub">
                  ({formatTermMonths(computed.withExtra.monthsActual)} вместо{' '}
                  {formatTermMonths(computed.months)})
                </div>
              </div>
              <div className="megaCard">
                <div className="megaLabel">Вы сэкономите на процентах</div>
                <div className="megaValue">{formatCur(savings)}</div>
                <div className="megaSub">
                  ({formatCur(baseTotals.totalInterest)} →{' '}
                  {formatCur(withExtraTotals.totalInterest)})
                </div>
              </div>
            </div>
            {closesInFirstMonth && (
              <div className="dirtyHint">
                Кредит закроется в первый месяц при такой доплате — это нормальный
                результат.
              </div>
            )}
          </section>

          <section className="panel">
            {balanceSeries && (
              <PaymentChart
                title="Остаток долга по месяцам"
                series={balanceSeries.series}
                months={balanceSeries.xMax}
              />
            )}
          </section>

          <section className="panel">
            <div className="panelTitle">Таблица по месяцам</div>
            {schedule.length === 0 ? (
              <div className="emptyState">Нет данных для построения таблицы.</div>
            ) : (
              <div className="tableWrap" role="region" aria-label="Досрочное погашение">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Месяц</th>
                      <th>Платёж</th>
                      <th>Проценты</th>
                      <th>Тело</th>
                      <th>Доп. платёж</th>
                      <th>Остаток</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((row) => (
                      <tr key={row.month}>
                        <td>{row.month}</td>
                        <td>{formatCur(row.payment)}</td>
                        <td>{formatCur(row.interestPart)}</td>
                        <td>{formatCur(row.principalPart)}</td>
                        <td>{formatCur(row.extraPaymentPart)}</td>
                        <td>{formatCur(row.balanceAfter)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  )
}

type PrepaymentPayTabProps = {
  canCalculate: boolean
  isDirty: boolean
  calcInput: {
    propertyPrice: number
    downPaymentMode: DownPaymentMode
    downPaymentValue: number
    annualRatePercent: number
    pdnThresholdPercent: number
    otherMonthlyPayments: number
    termValue: number
    termUnit: TermUnit
    paymentType: PaymentType
    extraPayment: number
  } | null
  onCalculate: () => void
  extraPaymentDigits: string
  extraPaymentRef: RefObject<HTMLInputElement>
  setExtraPaymentDigits: (value: string) => void
  setIsPrepayDirty: (value: boolean) => void
  formatTermMonths: (months: number) => string
  basePaymentInfo:
    | { type: 'annuity'; monthlyPayment: number }
    | { type: 'differentiated'; first: number; last: number }
    | null
}

function PrepaymentPayTab({
  canCalculate,
  isDirty,
  calcInput,
  onCalculate,
  extraPaymentDigits,
  extraPaymentRef,
  setExtraPaymentDigits,
  setIsPrepayDirty,
  basePaymentInfo,
}: PrepaymentPayTabProps) {
  const { currencySymbol } = useCurrency()
  const formatCur = useMemo(
    () => (amount: number) => formatCurrency(amount, currencySymbol),
    [currencySymbol],
  )

  const extraPayment = extraPaymentDigits === '' ? 0 : Number(extraPaymentDigits)

  const computed = useMemo(() => {
    if (!calcInput) return null

    const months = toMonths(calcInput.termValue, calcInput.termUnit)
    const downPaymentAmount = calcDownPaymentAmountFromInput(
      calcInput.propertyPrice,
      calcInput.downPaymentMode,
      calcInput.downPaymentMode === 'percent'
        ? clamp(calcInput.downPaymentValue, 0, 100)
        : calcInput.downPaymentValue,
    )
    const principal = calcPrincipalFromDownPaymentAmount(
      calcInput.propertyPrice,
      downPaymentAmount,
    )
    const i = calcMonthlyRate(calcInput.annualRatePercent)
    const incomePayment =
      calcInput.paymentType === 'annuity'
        ? calcAnnuityMonthlyPayment(principal, calcInput.annualRatePercent, months)
        : principal / Math.max(1, months) + principal * i
    const requiredIncome = calcRequiredIncome(
      incomePayment,
      calcInput.otherMonthlyPayments,
      calcInput.pdnThresholdPercent,
    )

    const base = simulatePayReduction(
      calcInput.paymentType,
      principal,
      calcInput.annualRatePercent,
      months,
      0,
    )
    const withExtra = simulatePayReduction(
      calcInput.paymentType,
      principal,
      calcInput.annualRatePercent,
      months,
      calcInput.extraPayment,
    )
    return { months, principal, base, withExtra, incomePayment, requiredIncome }
  }, [calcInput])

  const requiredIncomeHint = useMemo(() => {
    if (!calcInput) return ''
    return `(при ПДН ≤ ${formatPercent(calcInput.pdnThresholdPercent)} и др. платежах ${formatCur(calcInput.otherMonthlyPayments)})`
  }, [calcInput, formatCur])

  const savings = useMemo(() => {
    if (!computed) return 0
    return computed.base.totalInterest - computed.withExtra.totalInterest
  }, [computed])

  const basePayments = useMemo(() => {
    if (!computed) return []
    return computed.base.schedule.map((r: EarlyRepaymentRow) => r.payment)
  }, [computed])

  const withExtraPayments = useMemo(() => {
    if (!computed) return []
    return computed.withExtra.schedule.map((r: EarlyRepaymentRow) => r.payment)
  }, [computed])

  const lastBasePayment = basePayments[basePayments.length - 1] ?? 0
  const lastWithExtraPayment = withExtraPayments[withExtraPayments.length - 1] ?? 0

  const paymentSeries = useMemo(() => {
    if (!computed || !calcInput) return null
    return {
      months: computed.months,
      series: [
        { label: 'Без доплат', values: basePayments, color: '#7dd3fc' },
        {
          label: `С доплатой ${formatCur(calcInput.extraPayment)}/мес`,
          values: withExtraPayments,
          color: '#a78bfa',
        },
      ],
    }
  }, [basePayments, calcInput, computed, formatCur, withExtraPayments])

  const schedule = useMemo(() => {
    if (!computed) return []
    return computed.withExtra.schedule as EarlyRepaymentRow[]
  }, [computed])

  return (
    <>
      <section className="panel">
        <div className="panelTitle">Досрочное погашение с уменьшением платежа</div>
        <div className="infoNote">
          Ежемесячный платёж будет постепенно уменьшаться. При достаточно большой доплате
          кредит может закрыться раньше исходного срока — это нормальный результат.
        </div>

        <div className="prepayTopGrid">
          <div className="prepayLeft">
            <div className="prepayBase">
              <div className="prepayBaseTitle">Ваш текущий платёж</div>
              {!basePaymentInfo ? (
                <div className="prepayBaseValue">—</div>
              ) : basePaymentInfo.type === 'annuity' ? (
                <>
                  <div className="prepayBaseValue">
                    {formatCur(basePaymentInfo.monthlyPayment)}
                  </div>
                  <div className="prepayBaseHint">Аннуитетный платёж (одинаков каждый месяц)</div>
                </>
              ) : (
                <>
                  <div className="prepayBaseValue">
                    {formatCur(basePaymentInfo.first)} → {formatCur(basePaymentInfo.last)}
                  </div>
                  <div className="prepayBaseHint">1-й месяц → последний (дифференцированный)</div>
                </>
              )}
            </div>

            <div className="prepayBase prepayIncome">
              <div className="prepayBaseTitle">Необходимый доход</div>
              <div className="prepayBaseValue">
                {calcInput && computed && Number.isFinite(computed.requiredIncome)
                  ? formatCur(computed.requiredIncome)
                  : '—'}
              </div>
              <div className="prepayBaseHint">{requiredIncomeHint}</div>
            </div>
          </div>

          <div className="field">
            <div className="fieldLabel">{`Доп. платёж, ${currencySymbol}/мес`}</div>
            <input
              className="fieldInput"
              inputMode="numeric"
              type="text"
              ref={extraPaymentRef}
              value={formatDigits(extraPaymentDigits)}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const input = e.target
                const cursor = input.selectionStart ?? input.value.length
                const digitsBeforeCursor = digitsOnly(input.value.slice(0, cursor)).length
                const nextDigits = digitsOnly(input.value)

                setExtraPaymentDigits(nextDigits)
                setIsPrepayDirty(true)

                requestAnimationFrame(() => {
                  const el = extraPaymentRef.current
                  if (!el) return
                  setCursorByDigits(el, Math.min(digitsBeforeCursor, nextDigits.length))
                })
              }}
            />
            <div className="fieldHint">
              {extraPayment > 0
              ? `Каждый месяц +${formatCur(extraPayment)}`
              : `${formatCur(0)} — без доплаты`}
            </div>
          </div>
        </div>

        <div className="formActions">
          <button
            className="primaryButton"
            type="button"
            disabled={!canCalculate}
            onClick={onCalculate}
          >
            Посчитать
          </button>
          {calcInput && isDirty && (
            <div className="dirtyHint">
              Данные изменены — нажмите «Посчитать» для обновления результата.
            </div>
          )}
        </div>
      </section>

      {!calcInput ? (
        <section className="panel">
          <div className="emptyState">
            Задайте доплату и нажмите «Посчитать», чтобы увидеть эффект.
          </div>
        </section>
      ) : !computed ? null : (
        <>
          <section className="panel">
            <div className="panelTitle">Было / Стало</div>
            <CompareSummary
              changedLabel={`С досрочным (${formatCur(calcInput.extraPayment)}/мес)`}
              rows={[
                {
                  label: 'Срок кредита',
                  base: `${computed.months} мес`,
                  changed: `${computed.withExtra.schedule.length} мес`,
                },
                {
                  label: 'Ежемесячный платёж',
                  base:
                    basePaymentInfo?.type === 'annuity'
                      ? formatCur(basePaymentInfo.monthlyPayment)
                      : basePaymentInfo
                        ? `${formatCur(basePaymentInfo.first)} → ${formatCur(basePaymentInfo.last)}`
                        : '—',
                  changed:
                    schedule.length > 0
                      ? `${formatCur(schedule[0]?.payment ?? 0)} → ${formatCur(lastWithExtraPayment)}`
                      : '—',
                },
                {
                  label: 'Переплата по процентам',
                  base: formatCur(computed.base.totalInterest),
                  changed: formatCur(computed.withExtra.totalInterest),
                },
              ]}
            />
          </section>

          <section className="panel">
            <div className="megaGrid">
              <div className="megaCard">
                <div className="megaLabel">Платёж в последний месяц</div>
                <div className="megaValue">{formatCur(lastWithExtraPayment)}</div>
                <div className="megaSub">
                  вместо {formatCur(lastBasePayment)} (было)
                </div>
              </div>
              <div className="megaCard">
                <div className="megaLabel">Вы сэкономите на процентах</div>
                <div className="megaValue">{formatCur(savings)}</div>
                <div className="megaSub">
                  ({formatCur(computed.base.totalInterest)} →{' '}
                  {formatCur(computed.withExtra.totalInterest)})
                </div>
              </div>
            </div>
          </section>

          <section className="panel">
            {paymentSeries && (
              <PaymentChart
                title="Платёж по месяцам"
                series={paymentSeries.series}
                months={paymentSeries.months}
              />
            )}
          </section>

          <section className="panel">
            <div className="panelTitle">Таблица по месяцам</div>
            {schedule.length === 0 ? (
              <div className="emptyState">Нет данных для построения таблицы.</div>
            ) : (
              <div className="tableWrap" role="region" aria-label="Уменьшение платежа">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Месяц</th>
                      <th>Платёж</th>
                      <th>Проценты</th>
                      <th>Тело</th>
                      <th>Доп. платёж</th>
                      <th>Остаток</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((row) => (
                      <tr key={row.month}>
                        <td>{row.month}</td>
                        <td>{formatCur(row.payment)}</td>
                        <td>{formatCur(row.interestPart)}</td>
                        <td>{formatCur(row.principalPart)}</td>
                        <td>{formatCur(row.extraPaymentPart)}</td>
                        <td>{formatCur(row.balanceAfter)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  )
}
