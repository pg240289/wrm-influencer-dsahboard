import React from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { useTheme } from '@/contexts/ThemeContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const formatNumber = (num) => {
  if (num == null) return '0'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}

export const formatDate = (s) => {
  if (!s) return '—'
  const d = new Date(s)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ChartTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
        <p className="mb-1 font-medium text-foreground">{formatDate(label)}</p>
        {payload.map((e, i) => (
          <p key={i} style={{ color: e.color }}>{`${e.name || e.dataKey}: ${formatNumber(e.value)}`}</p>
        ))}
      </div>
    )
  }
  return null
}

function useChartColors() {
  const { theme } = useTheme()
  return { grid: theme === 'dark' ? '#27272a' : '#eef2f7', axis: theme === 'dark' ? '#71717a' : '#94a3b8' }
}

/** Themed area chart card with an optional cumulative/daily toggle. */
export function MetricAreaChart({ id, title, data = [], dataKey, color, height = 280, mode, onMode }) {
  const { grid, axis } = useChartColors()
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        {onMode && (
          <div className="inline-flex rounded-md bg-muted p-0.5 text-xs">
            {['cumulative', 'daily'].map((m) => (
              <button
                key={m}
                onClick={() => onMode(m)}
                className={`rounded px-2.5 py-1 font-medium capitalize transition-colors ${
                  mode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="date" stroke={axis} fontSize={11} tickFormatter={formatDate} axisLine={false} tickLine={false} />
              <YAxis stroke={axis} fontSize={11} tickFormatter={formatNumber} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} fill={`url(#${id})`}
                dot={{ r: 3, fill: color, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 5 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">No data available</div>
        )}
      </CardContent>
    </Card>
  )
}

/** Themed bar chart (e.g. publishing timeline). */
export function TimelineBarChart({ data = [], dataKey = 'content_count', color = '#6366f1', height = 300, name = 'Posts' }) {
  const { grid, axis } = useChartColors()
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
        <XAxis dataKey="date" stroke={axis} fontSize={11} tickFormatter={formatDate} axisLine={false} tickLine={false} />
        <YAxis stroke={axis} fontSize={11} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey={dataKey} name={name} fill={color} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export const CHART_PALETTE = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6']

/** Simple name: value tooltip (for pie / categorical charts). */
export function ValueTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const p = payload[0]
    return (
      <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
        <span className="font-medium text-foreground">{p.name}</span>
        <span className="text-muted-foreground">: {formatNumber(p.value)}</span>
      </div>
    )
  }
  return null
}

/** Donut chart for categorical breakdowns. data: [{ name, value }]. */
export function DonutChart({ data = [], height = 260 }) {
  if (!data.length) {
    return <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>No data</div>
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2} stroke="none">
          {data.map((_, i) => <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />)}
        </Pie>
        <Tooltip content={<ValueTooltip />} />
        <Legend iconType="circle" formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
      </PieChart>
    </ResponsiveContainer>
  )
}

/** Horizontal bar chart for ranked categories. data: [{ name, value }]. */
export function HorizontalBarChart({ data = [], color = '#6366f1', height = 300 }) {
  const { grid, axis } = useChartColors()
  if (!data.length) {
    return <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>No data</div>
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke={grid} />
        <XAxis type="number" stroke={axis} fontSize={11} tickFormatter={formatNumber} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" stroke={axis} fontSize={11} width={130} axisLine={false} tickLine={false} />
        <Tooltip content={<ValueTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }} />
        <Bar dataKey="value" fill={color} radius={[0, 6, 6, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  )
}
