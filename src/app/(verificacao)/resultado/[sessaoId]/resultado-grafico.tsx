"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useChartTheme, type ChartTheme } from "@/lib/use-chart-theme";

interface Materia {
  id: string;
  nome: string;
  total: number;
  acertos: number;
  taxa: number;
}

interface Props {
  materias: Materia[];
}

function getBarColor(taxa: number, t: ChartTheme): string {
  if (taxa >= 0.7) return t.series.positive; // verde
  if (taxa >= 0.5) return t.series.warning; // âmbar
  return t.series.negative; // vermelho
}

export default function ResultadoGrafico({ materias }: Props) {
  const t = useChartTheme();
  const dados = materias.map((m) => ({
    nome: m.nome.length > 20 ? m.nome.slice(0, 18) + "…" : m.nome,
    nomeCompleto: m.nome,
    taxa: Math.round(m.taxa * 100),
    total: m.total,
    acertos: m.acertos,
  }));

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={dados}
          layout="vertical"
          margin={{ top: 4, right: 48, left: 8, bottom: 4 }}
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11, fill: t.axis }}
          />
          <YAxis
            type="category"
            dataKey="nome"
            width={160}
            tick={{ fontSize: 11, fill: t.axis }}
          />
          <Tooltip
            {...t.tooltipProps}
            formatter={(value, _name, props) => {
              const { acertos, total, nomeCompleto } = props.payload;
              return [`${value}% (${acertos}/${total})`, nomeCompleto];
            }}
          />
          <Bar dataKey="taxa" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {dados.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.taxa / 100, t)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-3 justify-center text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: t.series.positive }} /> ≥ 70%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: t.series.warning }} /> 50–69%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: t.series.negative }} /> &lt; 50%
        </span>
      </div>
    </div>
  );
}
