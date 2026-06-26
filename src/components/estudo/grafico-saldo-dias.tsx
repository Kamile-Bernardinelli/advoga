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
  if (dados.length === 0) {
    return (
      <p className="text-sm text-gray-400 italic text-center py-4">
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
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="dia"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          unit=" m"
        />
        <Tooltip
          formatter={(value, name) => [
            typeof value === "number" ? `${value}min` : `${value}`,
            name === "meta" ? "Meta" : "Real",
          ]}
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
        />
        <Legend
          formatter={(value) => (value === "meta" ? "Meta" : "Real")}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="meta" fill="#e5e7eb" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="real" fill="#3b82f6" radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
