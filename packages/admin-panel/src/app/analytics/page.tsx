"use client";

import { useState, useEffect } from "react";
import { MetricCard } from "@/components/analytics/metric-card";
import {
  TacticalLineChart,
  TacticalBarChart,
} from "@/components/analytics/charts";
import { Users, DollarSign, Database, Box } from "lucide-react";
import {
  getAnalyticsSummary,
  type AnalyticsSummary,
} from "@/lib/actions/analytics";

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const result = await getAnalyticsSummary();
        setData(result);
      } catch (err) {
        console.error("Failed to load analytics", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading || !data) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-(--text-muted) animate-pulse font-mono">
          INITIALIZING TACTICAL DATA FEED...
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col gap-4 overflow-y-auto custom-scrollbar p-2">
      {/* Header Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Registered Users"
          value={data.counts.activePlayers.toLocaleString()}
          icon={<Users className="w-4 h-4 text-(--accent-primary)" />}
        />
        <MetricCard
          label="Total Zones"
          value={data.counts.totalZones}
          icon={<Database className="w-4 h-4 text-(--color-success)" />}
        />
        <MetricCard
          label="World Entities"
          value={(
            data.counts.totalNpcs +
            data.counts.totalSpawners +
            data.counts.totalResources
          ).toLocaleString()}
          icon={<Box className="w-4 h-4 text-(--color-warning)" />}
        />
        <MetricCard
          label="Total Characters"
          value={data.counts.economyVolume.toLocaleString()}
          icon={<DollarSign className="w-4 h-4 text-(--color-info)" />}
        />
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-96">
        <div className="lg:col-span-2 h-full">
          <TacticalLineChart
            title="Player Concurrency (24h)"
            data={data.performance.players}
            color="var(--accent-primary)"
            height={380}
          />
        </div>
        <div className="h-full">
          <TacticalBarChart
            title="Entity Density by Zone"
            data={data.zoneDistribution}
            color="var(--color-info)"
            height={380}
          />
        </div>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-64">
        <TacticalLineChart
          title="Server CPU Load"
          data={data.performance.cpu}
          color="var(--color-danger)"
          height={250}
        />
        <TacticalBarChart
          title="World Composition"
          data={data.entityComposition}
          color="var(--color-warning)"
          height={250}
        />
      </div>
    </div>
  );
}
