import { useEffect, useMemo, useRef, useState } from 'react'
import { downsampleSeries } from './calc'
import { formatCurrency } from './format'
import { useCurrency } from './currency'

export type ChartSeries = {
  label: string
  values: number[]
  color: string
}

type Props = {
  series: ChartSeries[]
  months: number
  title?: string
}

function buildPath(
  points: { x: number; y: number }[],
  xMax: number,
  yMax: number,
  padding: number,
  width: number,
  height: number,
): string {
  const innerW = width - padding * 2
  const innerH = height - padding * 2

  return points
    .map((p, idx) => {
      const x = padding + (p.x / xMax) * innerW
      const y = padding + innerH - (p.y / yMax) * innerH
      return `${idx === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function pickStep(value: number, candidates: number[]) {
  for (const c of candidates) {
    if (c >= value) return c
  }
  return candidates[candidates.length - 1] ?? value
}

function buildXTicks(
  months: number,
  availableWidthPx: number,
): { value: number; label: string }[] {
  const safeMonths = Math.max(1, Math.floor(months))
  const maxTicks = clamp(Math.floor(availableWidthPx / 90), 3, 10)

  if (safeMonths < 24) {
    const rawStep = Math.ceil(safeMonths / (maxTicks - 1))
    const step = pickStep(rawStep, [1, 2, 3, 4, 6, 12])
    const ticks: { value: number; label: string }[] = [{ value: 0, label: '0' }]

    for (let m = step; m < safeMonths; m += step) {
      ticks.push({ value: m, label: String(m) })
    }

    ticks.push({ value: safeMonths, label: String(safeMonths) })
    return ticks
  }

  const totalYears = Math.ceil(safeMonths / 12)
  const rawYearStep = Math.ceil(totalYears / (maxTicks - 1))
  const yearStep = pickStep(rawYearStep, [1, 2, 3, 5, 10])
  const ticks: { value: number; label: string }[] = [{ value: 0, label: '0' }]

  for (let y = yearStep; y <= totalYears; y += yearStep) {
    const m = y * 12
    if (m >= safeMonths) break
    ticks.push({ value: m, label: `Год ${y}` })
  }

  const lastLabel =
    safeMonths % 12 === 0 ? `Год ${safeMonths / 12}` : String(safeMonths)
  ticks.push({ value: safeMonths, label: lastLabel })
  return ticks
}

export default function PaymentChart({ series, months, title }: Props) {
  const { currencySymbol } = useCurrency()
  const { width, height, padding } = { width: 960, height: 320, padding: 28 }
  const canvasRef = useRef<HTMLDivElement>(null)
  const [canvasWidth, setCanvasWidth] = useState(0)

  const prepared = useMemo(() => {
    const filtered = series.filter((s) => s.values.length > 0)
    const allValues = filtered.flatMap((s) => s.values)
    const yMax = Math.max(...allValues, 1)

    return {
      yMax,
      items: filtered.map((s) => ({
        ...s,
        points: downsampleSeries(s.values, 220),
      })),
    }
  }, [series])

  const xMax = Math.max(months, 1)
  const yMax = prepared.yMax
  const legend = prepared.items

  if (legend.length === 0) return null

  const yLabels = [yMax, yMax * 0.66, yMax * 0.33, 0]
  const innerH = height - padding * 2
  const innerW = width - padding * 2

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return

    const update = () => setCanvasWidth(el.clientWidth)
    update()

    const ro = new ResizeObserver(() => update())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const xTicks = useMemo(() => buildXTicks(xMax, canvasWidth || 960), [canvasWidth, xMax])
  const axisMode = xMax < 24 ? 'month' : 'year'

  const payoffMonth = useMemo(() => {
    const highlight = series[series.length - 1]
    if (!highlight || highlight.values.length === 0) return null
    const idx = highlight.values.findIndex((v) => v <= 1e-9)
    if (idx === -1) return null
    const m = idx + 1
    if (m <= 0 || m >= xMax) return null
    return m
  }, [series, xMax])

  return (
    <div className="chart">
      <div className="chartHeader">
        <div className="chartTitle">{title ?? 'График платежей по месяцам'}</div>
        <div className="chartLegend">
          {legend.map((s) => (
            <div className="chartLegendItem" key={s.label}>
              <span
                className="chartLegendDot"
                style={{ background: s.color }}
              />
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="chartCanvas" ref={canvasRef}>
        <svg viewBox={`0 0 ${width} ${height}`} role="img">
          {yLabels.map((value) => {
            const y = padding + innerH - (value / yMax) * innerH
            return (
              <g key={value}>
                <line
                  x1={padding}
                  y1={y}
                  x2={width - padding}
                  y2={y}
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth={1}
                />
                <text
                  x={padding}
                  y={y - 6}
                  fill="rgba(255,255,255,0.75)"
                  fontSize="12"
                >
                  {formatCurrency(value, currencySymbol)}
                </text>
              </g>
            )
          })}

          {payoffMonth !== null && (
            <g>
              <line
                x1={padding + (payoffMonth / xMax) * innerW}
                y1={padding}
                x2={padding + (payoffMonth / xMax) * innerW}
                y2={height - padding}
                stroke="rgba(255,255,255,0.28)"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={padding + (payoffMonth / xMax) * innerW}
                y={padding + 14}
                fill="rgba(255,255,255,0.78)"
                fontSize="12"
                textAnchor={payoffMonth / xMax > 0.55 ? 'end' : 'start'}
                dx={payoffMonth / xMax > 0.55 ? -8 : 8}
              >
                {`Погашено на ${payoffMonth}-м месяце`}
              </text>
            </g>
          )}

          {prepared.items.map((s) => (
            <path
              key={s.label}
              d={buildPath(s.points, xMax, yMax, padding, width, height)}
              fill="none"
              stroke={s.color}
              strokeWidth={3}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          <line
            x1={padding}
            y1={height - padding}
            x2={width - padding}
            y2={height - padding}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={1}
          />

          {xTicks.map((t) => {
            const x = padding + (clamp(t.value, 0, xMax) / xMax) * innerW
            const isFirst = t.value <= 0
            const isLast = t.value >= xMax
            const textAnchor = isFirst ? 'start' : isLast ? 'end' : 'middle'
            const dx = isFirst ? 2 : isLast ? -2 : 0
            return (
              <g key={t.value}>
                <line
                  x1={x}
                  y1={height - padding}
                  x2={x}
                  y2={height - padding + 6}
                  stroke="rgba(255,255,255,0.18)"
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={height - padding + 20}
                  fill="rgba(255,255,255,0.68)"
                  fontSize="12"
                  textAnchor={textAnchor}
                  dx={dx}
                >
                  {t.label}
                </text>
              </g>
            )
          })}

          <text
            x={padding + innerW / 2}
            y={height - padding - 10}
            fill="rgba(255,255,255,0.55)"
            fontSize="12"
            textAnchor="middle"
          >
            {axisMode === 'month' ? 'Месяцы' : 'Годы'}
          </text>
        </svg>
      </div>
    </div>
  )
}
