"use client";

// Gráfico de progresso mensal: real × meta (anel/barra).
// Usa RadialBarChart do Recharts para exibir o anel de progresso.

import {
  RadialBarChart,
  RadialBar,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { SaldoMes } from "@/lib/types/domain";
import { useChartTheme } from "@/lib/use-chart-theme";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface GraficoProgressoMensalProps {
  saldoMes: SaldoMes | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatarMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}min`;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function GraficoProgressoMensal({ saldoMes }: GraficoProgressoMensalProps) {
  const t        = useChartTheme();
  const realMin  = saldoMes?.realMin ?? 0;
  const metaMin  = saldoMes?.metaMensalMin ?? null;
  const pct      = saldoMes?.pctMeta ?? null;

  if (!metaMin || metaMin === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-center">
        <p className="text-sm text-muted-foreground">Sem meta mensal definida.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Defina abaixo para ver o progresso do contrato.
        </p>
      </div>
    );
  }

  const pctDisplay = pct ?? Math.round((realMin / metaMin) * 100);
  const pctCapped  = Math.min(100, pctDisplay);
  const cor        = pctDisplay >= 100 ? t.series.positive : pctDisplay >= 60 ? t.series.primary : t.series.warning;

  const chartData = [
    { name: "Progresso", value: pctCapped, fill: cor },
  ];

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-full" style={{ height: 160 }}>
        <ResponsiveContainer width="100%" height={160}>
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="80%"
            barSize={14}
            data={chartData}
            startAngle={90}
            endAngle={-270}
          >
            <RadialBar
              background={{ fill: t.series.metaBar }}
              dataKey="value"
              isAnimationActive={false}
            />
            <Tooltip
              {...t.tooltipProps}
              formatter={(value) => [typeof value === "number" ? `${value}%` : `${value}`, "Progresso"]}
            />
          </RadialBarChart>
        </ResponsiveContainer>

        {/* Texto central — sobreposto exatamente no centro do anel (não colide com o traço). */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          <span className="text-2xl font-bold leading-none" style={{ color: cor }}>
            {pctDisplay}%
          </span>
          <p className="text-xs text-muted-foreground mt-1">
            {formatarMin(realMin)} de {formatarMin(metaMin)}
          </p>
        </div>
      </div>
    </div>
  );
}
