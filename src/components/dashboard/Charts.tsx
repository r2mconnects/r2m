"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS = ["#0756B5", "#16a34a", "#F59E0B", "#7c3aed", "#ec4899", "#0891b2", "#dc2626", "#64748b"];

export function AreaTrend({ data, color = "#0756B5" }: { data: Array<{ label: string; value: number }>; color?: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ left: -15, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={color} stopOpacity={0.3} /><stop offset="95%" stopColor={color} stopOpacity={0} /></linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" fontSize={11} />
        <YAxis fontSize={11} allowDecimals={false} />
        <Tooltip />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill="url(#g1)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Donut({ data, total }: { data: Array<{ name: string; value: number }>; total: number }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="relative h-44 w-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-navy">{total.toLocaleString("en-IN")}</span>
          <span className="text-[10px] text-slate-500">Members</span>
        </div>
      </div>
      <ul className="space-y-1 text-sm">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="w-28 truncate">{d.name}</span>
            <span className="font-semibold">{d.value}</span>
            <span className="text-xs text-slate-400">({total ? ((d.value / total) * 100).toFixed(1) : 0}%)</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Bars({ data, color = "#0756B5", prefix = "" }: { data: Array<{ label: string; value: number }>; color?: string; prefix?: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: -10, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" fontSize={11} />
        <YAxis fontSize={11} allowDecimals={false} />
        <Tooltip formatter={(v) => `${prefix}${Number(v).toLocaleString("en-IN")}`} />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
