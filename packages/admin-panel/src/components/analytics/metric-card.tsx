import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: React.ReactNode;
  className?: string;
  loading?: boolean;
}

export function MetricCard({
  label,
  value,
  trend,
  icon,
  className,
  loading = false,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "relative p-4 rounded-sm border border-(--border-primary) bg-(--bg-secondary)/50 overflow-hidden group",
        className,
      )}
    >
      {/* Background Accent */}
      <div className="absolute top-0 right-0 w-16 h-16 bg-(--accent-primary)/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />

      <div className="relative flex justify-between items-start mb-2">
        <span className="text-xs font-mono text-(--text-muted) uppercase tracking-wider">
          {label}
        </span>
        {icon || (
          <Activity className="w-4 h-4 text-(--text-muted) opacity-50" />
        )}
      </div>

      <div className="relative">
        {loading ? (
          <div className="h-8 w-24 bg-(--bg-primary) animate-pulse rounded" />
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-(--text-primary) tracking-tight">
              {value}
            </span>
            {trend && (
              <div
                className={cn(
                  "flex items-center text-xs font-mono",
                  trend.isPositive
                    ? "text-(--color-success)"
                    : "text-(--color-danger)",
                )}
              >
                {trend.isPositive ? (
                  <ArrowUpRight className="w-3 h-3 mr-0.5" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 mr-0.5" />
                )}
                {Math.abs(trend.value)}%
              </div>
            )}
          </div>
        )}
      </div>

      {/* Decorative Corner */}
      <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-(--accent-primary) opacity-50 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
