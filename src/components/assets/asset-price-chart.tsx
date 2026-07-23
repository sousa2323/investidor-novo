"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { formatCurrencyFromCents, formatDate } from "@/lib/formatters";
import type { AssetPricePoint } from "@/types/investment";

const rangeOptions = [
  { value: "1M", label: "1M", days: 30 },
  { value: "6M", label: "6M", days: 182 },
  { value: "1A", label: "1A", days: 365 },
  { value: "5A", label: "5A", days: 1_826 },
] as const;

type RangeValue = (typeof rangeOptions)[number]["value"];

interface AssetPriceChartProps {
  priceHistory: AssetPricePoint[];
}

export function AssetPriceChart({ priceHistory }: AssetPriceChartProps) {
  const [range, setRange] = useState<RangeValue>("1A");

  const chartData = useMemo(() => {
    const selectedRange =
      rangeOptions.find((option) => option.value === range) ?? rangeOptions[2];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - selectedRange.days);
    const cutoffDate = cutoff.toISOString().slice(0, 10);

    return priceHistory
      .filter((point) => point.date >= cutoffDate)
      .map((point) => ({
        date: point.date,
        price: point.closeCents / 100,
      }));
  }, [priceHistory, range]);

  const isPositive =
    chartData.length >= 2 &&
    chartData[chartData.length - 1].price >= chartData[0].price;
  const strokeColor = isPositive ? "var(--color-primary)" : "#dc2626";

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-end gap-1">
        {rangeOptions.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={range === option.value ? "secondary" : "ghost"}
            onClick={() => setRange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {chartData.length < 2 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 px-5 py-10 text-center">
          <p className="text-sm font-medium">Série insuficiente neste período</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted-foreground">
            O histórico disponível não cobre a janela escolhida. Períodos ausentes
            não são preenchidos com estimativas.
          </p>
        </div>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ left: 8, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                minTickGap={40}
                tickFormatter={(value: string) =>
                  new Intl.DateTimeFormat("pt-BR", {
                    month: "short",
                    year: "2-digit",
                  }).format(new Date(`${value}T00:00:00`))
                }
                className="text-xs"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={64}
                domain={["auto", "auto"]}
                tickFormatter={(value: number) =>
                  value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })
                }
                className="text-xs"
              />
              <Tooltip
                labelFormatter={(label) =>
                  typeof label === "string" ? formatDate(`${label}T00:00:00`) : ""
                }
                formatter={(value) => [
                  typeof value === "number"
                    ? formatCurrencyFromCents(Math.round(value * 100))
                    : "—",
                  "Fechamento",
                ]}
                contentStyle={{
                  borderRadius: "0.5rem",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-card)",
                  fontSize: "0.75rem",
                }}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={strokeColor}
                strokeWidth={2}
                fill="url(#priceGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
