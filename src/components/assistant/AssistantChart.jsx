import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function ChartTooltip({ active, payload, label, tooltipSuffix = ' zł', tooltipDecimals = 2 }) {
  if (!active || !payload?.length) return null
  const val = Number(payload[0]?.value ?? 0)
  const color = payload[0]?.fill ?? '#3b82f6'
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs"
      style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
    >
      <p className="font-medium mb-0.5">{label}</p>
      <p style={{ color, fontFamily: 'DM Mono, monospace' }}>
        {val.toLocaleString('pl-PL', { minimumFractionDigits: tooltipDecimals, maximumFractionDigits: tooltipDecimals })}{tooltipSuffix}
      </p>
    </div>
  )
}

export default function AssistantChart({ data, dataKey = 'totalNetto', title = 'Zakupy w czasie', xAxisKey = 'date', getBarColor, tooltipSuffix = ' zł', tooltipDecimals = 2 }) {
  if (!data?.length) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div className="px-4 py-2.5" style={{ background: 'var(--table-head)', borderBottom: '1px solid var(--border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{title}</p>
        </div>
        <p className="text-center py-6 text-sm" style={{ color: 'var(--muted)', background: 'var(--table-even)' }}>
          Brak danych do wykresu
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
      <div className="px-4 py-2.5" style={{ background: 'var(--table-head)', borderBottom: '1px solid var(--border)' }}>
        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{title}</p>
      </div>
      <div className="px-2 pt-3 pb-2" style={{ background: 'var(--bg)' }}>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={data} barCategoryGap="28%" margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
            <XAxis
              dataKey={xAxisKey}
              tick={{ fontSize: 10, fill: 'var(--muted)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'var(--muted)' }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
            />
            <Tooltip content={<ChartTooltip tooltipSuffix={tooltipSuffix} tooltipDecimals={tooltipDecimals} />} cursor={{ fill: 'rgba(59,130,246,0.07)' }} />
            <Bar dataKey={dataKey} fill="#3b82f6" radius={[3, 3, 0, 0]}>
              {getBarColor && data.map((entry, index) => (
                <Cell key={index} fill={getBarColor(entry)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
