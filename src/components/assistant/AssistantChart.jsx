import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts'

function BarChartTooltip({ active, payload, label, tooltipSuffix = ' zł', tooltipDecimals = 2 }) {
  if (!active || !payload?.length) return null
  const val = Number(payload[0]?.value ?? 0)
  const color = payload[0]?.fill ?? '#3b82f6'
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs"
      style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
    >
      <p className="font-medium mb-0.5">{label}</p>
      <p style={{ color, fontFamily: 'DM Mono, monospace' }}>
        {val.toLocaleString('pl-PL', { minimumFractionDigits: tooltipDecimals, maximumFractionDigits: tooltipDecimals })}{tooltipSuffix}
      </p>
    </div>
  )
}

function LineChartTooltip({ active, payload, tooltipSuffix = ' zł', tooltipDecimals = 2 }) {
  if (!active || !payload?.length) return null
  const entry = payload[0]?.payload
  const val = Number(payload[0]?.value ?? 0)
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs space-y-0.5"
      style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', maxWidth: 180, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
    >
      <p className="font-medium">{entry?.date ?? entry?.name}</p>
      <p style={{ color: '#3b82f6', fontFamily: 'DM Mono, monospace' }}>
        {val.toLocaleString('pl-PL', { minimumFractionDigits: tooltipDecimals, maximumFractionDigits: tooltipDecimals })}{tooltipSuffix}
      </p>
      {entry?.supplier && <p style={{ color: 'var(--text-2)' }}>{entry.supplier}</p>}
      {entry?.numer && <p style={{ color: 'var(--muted)' }}>{entry.numer}</p>}
    </div>
  )
}

export default function AssistantChart({
  data,
  dataKey = 'totalNetto',
  title = 'Zakupy w czasie',
  xAxisKey = 'date',
  getBarColor,
  tooltipSuffix = ' zł',
  tooltipDecimals = 2,
  type = 'bar',
  yAxisDomain,
}) {
  if (!data?.length) {
    return (
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        <div className="px-4 py-2.5" style={{ background: 'var(--table-head)', borderBottom: '1px solid var(--border)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{title}</p>
        </div>
        <p className="text-center py-8 text-sm" style={{ color: 'var(--muted)', background: 'var(--table-even)' }}>
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
      <div className="px-2 pt-4 pb-3" style={{ background: 'var(--bg)' }}>
        {type === 'line' ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey={xAxisKey}
                tick={{ fontSize: 10, fill: 'var(--muted)' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                tickFormatter={v => typeof v === 'string' && v.length === 10 ? v.slice(5) : v}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--muted)' }}
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              />
              <Tooltip content={<LineChartTooltip tooltipSuffix={tooltipSuffix} tooltipDecimals={tooltipDecimals} />} />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} barCategoryGap="30%" margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
              <XAxis
                dataKey={xAxisKey}
                tick={{ fontSize: 10, fill: 'var(--muted)' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={yAxisDomain}
                tick={{ fontSize: 10, fill: 'var(--muted)' }}
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              />
              <Tooltip content={<BarChartTooltip tooltipSuffix={tooltipSuffix} tooltipDecimals={tooltipDecimals} />} cursor={{ fill: 'rgba(59,130,246,0.07)' }} />
              <Bar dataKey={dataKey} fill="#3b82f6" radius={[4, 4, 0, 0]}>
                {getBarColor && data.map((entry, index) => (
                  <Cell key={index} fill={getBarColor(entry)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
