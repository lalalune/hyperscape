"use client";

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
} from "recharts";
import { cn } from "@/lib/utils";

interface ChartDataPoint {
  name: string;
  value: number;
}

interface TacticalChartProps {
  data: ChartDataPoint[];
  title?: string;
  color?: string;
  height?: number;
  className?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-(--bg-secondary) border border-(--border-primary) p-2 text-xs font-mono shadow-xl backdrop-blur-md">
        <p className="text-(--text-muted) mb-1 border-b border-(--border-primary) pb-1">
          {label}
        </p>

        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {payload.map((entry: any, idx: number) => (
          <p key={idx} style={{ color: entry.color }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function TacticalLineChart({
  data,
  title,
  height = 300,
  className,
  color = "var(--accent-primary)",
}: TacticalChartProps) {
  return (
    <div
      className={cn(
        "flex flex-col h-full p-4 border border-(--border-primary) bg-(--bg-secondary)/30 rounded-sm relative",
        className,
      )}
    >
      {title && (
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-(--text-primary) uppercase tracking-widest">
            {title}
          </h3>
          <div className="flex gap-1">
            <div className="w-1 h-1 bg-(--accent-primary) rounded-full animate-pulse" />
            <div className="w-1 h-1 bg-(--accent-primary) rounded-full animate-pulse delay-75" />
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-primary)"
              opacity={0.3}
              vertical={false}
            />
            <XAxis
              dataKey="name"
              stroke="var(--text-muted)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              stroke="var(--text-muted)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              dx={-10}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: "var(--border-primary)", strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorValue)"
              activeDot={{ r: 4, strokeWidth: 0, fill: "var(--text-primary)" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Decorative Corner */}
      <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-(--accent-primary) opacity-50" />
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-(--accent-primary) opacity-50" />
    </div>
  );
}

export function TacticalBarChart({
  data,
  title,
  height = 300,
  className,
  color = "var(--accent-primary)",
}: TacticalChartProps) {
  return (
    <div
      className={cn(
        "flex flex-col h-full p-4 border border-(--border-primary) bg-(--bg-secondary)/30 rounded-sm relative",
        className,
      )}
    >
      {title && (
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-(--text-primary) uppercase tracking-widest">
            {title}
          </h3>
        </div>
      )}

      <div className="flex-1 min-h-0 w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-primary)"
              opacity={0.3}
              vertical={false}
            />
            <XAxis
              dataKey="name"
              stroke="var(--text-muted)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              stroke="var(--text-muted)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              dx={-10}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "var(--bg-primary)", opacity: 0.5 }}
            />
            <Bar
              dataKey="value"
              fill={color}
              radius={[2, 2, 0, 0]}
              fillOpacity={0.8}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
