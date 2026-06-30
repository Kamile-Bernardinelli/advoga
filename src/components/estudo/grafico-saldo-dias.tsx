"use client";

// Gráfico de barras: real × meta por dia (últimos ~14 dias).
// Recharts BarChart — sem CSS animations (native Remotion rule não se aplica aqui,
// mas mantemos simples: isAnimationActive={false} para evitar flash no SSR).

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { SaldoDia } from "@/lib/types/domain";
import { useChartTheme } from "@/lib/use-chart-theme";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface GraficoSaldoDiasProps {
  dados: SaldoDia[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatarDia(iso: string): string {
  const [, , day] = iso.split("-");
  return day + "/" + iso.split("-")[1]; // DD/MM
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function GraficoSaldoDias({ dados }: GraficoSaldoDiasProps) {
  const t = useChartTheme();
  if (dados.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic text-center py-4">
        Sem dados de saldo ainda.
      </p>
    );
  }

  const chartData = dados.map((d) => ({
    dia:    formatarDia(d.dia),
    meta:   d.metaMin,
    real:   d.realMin,
    saldo:  d.saldoDia,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={t.grid} />
        <XAxis
          dataKey="dia"
          tick={{ fontSize: 11, fill: t.axis }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: t.axis }}
          axisLine={false}
          tickLine={false}
          unit=" m"
        />
        <Tooltip
          {...t.tooltipProps}
          formatter={(value, name) => [
            typeof value === "number" ? `${value}min` : `${value}`,
            name === "meta" ? "Meta" : "Real",
          ]}
        />
        <Legend
          formatter={(value) => (value === "meta" ? "Meta" : "Real")}
          wrapperStyle={{ fontSize: 12, color: t.axis }}
        />
        <Bar dataKey="meta" fill={t.series.metaBar} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="real" fill={t.series.primary} radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
