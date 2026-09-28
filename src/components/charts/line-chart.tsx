"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function SimpleLineChart({
  data,
  dataKey = "count",
  labelKey = "month",
  color = "#296c57",
  height = 260,
}: {
  data: { [key: string]: string | number }[];
  dataKey?: string;
  labelKey?: string;
  color?: string;
  height?: number;
}) {
  if (!data.length) {
    return <div className="flex h-[260px] items-center justify-center text-sm text-slate-400">No data yet</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
        <Tooltip />
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
