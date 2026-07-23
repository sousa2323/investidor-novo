"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatCurrencyFromCents } from "@/lib/formatters";
import type { PortfolioPosition } from "@/types/investment";

const allocationColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function AllocationChart({
  positions,
  currentPricesCents,
}: {
  positions: PortfolioPosition[];
  currentPricesCents: Record<string, number>;
}) {
  const chartData = positions
    .filter((position) => position.quantity > 0)
    .map((position) => ({
      name: position.ticker,
      value:
        position.quantity *
        (currentPricesCents[position.ticker] ?? position.averagePriceCents),
    }));

  if (chartData.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Registre uma compra para ver a alocação.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            stroke="var(--card)"
            strokeWidth={3}
          >
            {chartData.map((chartEntry, chartIndex) => (
              <Cell
                key={chartEntry.name}
                fill={allocationColors[chartIndex % allocationColors.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => formatCurrencyFromCents(Number(value))}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--card)",
              fontSize: 12,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PortfolioEvolutionChart({
  snapshots,
}: {
  snapshots: Array<{
    snapshotDate: string;
    marketValueCents: number;
  }>;
}) {
  if (snapshots.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-center text-sm text-muted-foreground">
        A evolução aparecerá após a primeira rotina diária de fechamento.
      </div>
    );
  }

  const chartData = snapshots.map((snapshot) => ({
    date: new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
    }).format(new Date(`${snapshot.snapshotDate}T12:00:00`)),
    value: snapshot.marketValueCents,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="portfolioArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.22} />
              <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis dataKey="date" axisLine={false} tickLine={false} fontSize={11} />
          <YAxis hide />
          <Tooltip
            formatter={(value) => formatCurrencyFromCents(Number(value))}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--card)",
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--chart-1)"
            fill="url(#portfolioArea)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
