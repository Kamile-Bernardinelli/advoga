"use client";

// Grafico de barras horizontais: tempo por materia.
// Recharts BarChart horizontal.

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TempoPorNo } from "@/lib/types/domain";

interface GraficoTempoPorMateriaProps {
  dados: TempoPorNo[];
}

function formatarMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}min`;
}

export function GraficoTempoPorMateria({ dados }: GraficoTempoPorMateriaProps) {
  if (dados.length === 0) return null;

  // Trunca nomes longos para o eixo Y
  const chartData = dados.slice(0, 15).map((d) => ({
    nome:   d.noNome.length > 25 ? d.noNome.slice(0, 23) + "…" : d.noNome,
    min:    d.totalMin,
  }));

  const height = Math.max(180, chartData.length * 36);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 32, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => formatarMin(v)}
        />
        <YAxis
          type="category"
          dataKey="nome"
          width={140}
          tick={{ fontSize: 11, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value) => [
            typeof value === "number" ? formatarMin(value) : `${value}`,
            "Tempo",
          ]}
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
        />
        <Bar dataKey="min" fill="#3b82f6" radius={[0, 4, 4, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
