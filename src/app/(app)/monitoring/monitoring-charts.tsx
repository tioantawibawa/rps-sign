"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = ["#075E9B", "#14A6B8", "#F5A623", "#16A36A", "#DC4C4C", "#94a3b8"];

export function StatusBarChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5edf3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#5b6b7a" }} interval={0} angle={-20} textAnchor="end" height={60} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#5b6b7a" }} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #dbe3ec" }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AgingBarChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5edf3" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#5b6b7a" }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#5b6b7a" }} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #dbe3ec" }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#F5A623" />
      </BarChart>
    </ResponsiveContainer>
  );
}
