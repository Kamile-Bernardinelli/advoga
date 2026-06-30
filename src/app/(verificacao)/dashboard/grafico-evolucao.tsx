"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { useChartTheme } from "@/lib/use-chart-theme";

interface Ponto {
  data: string;
  taxa: number;
  total: number;
  acertos: number;
}

interface Props {
  dados: Ponto[];
}

export default function GraficoEvolucao({ dados }: Props) {
  const t = useChartTheme();

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={dados}
          margin={{ top: 8, right: 16, left: 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={t.grid} />
          <XAxis
            dataKey="data"
            tick={{ fontSize: 10, fill: t.axis }}
            tickFormatter={(v: string) => v.slice(5)} // MM-DD
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 10, fill: t.axis }}
          />
          <Tooltip
            {...t.tooltipProps}
            formatter={(value, _name, props) => {
              const p = props.payload;
              return [`${value}% (${p.acertos}/${p.total})`, "Taxa de acerto"];
            }}
            labelFormatter={(label) => `Data: ${label}`}
          />
          <ReferenceLine y={70} stroke={t.series.reference} strokeDasharray="4 2" label={{ value: "70%", fill: t.series.reference, fontSize: 10 }} />
          <Line
            type="monotone"
            dataKey="taxa"
            stroke={t.series.primary}
            strokeWidth={2}
            dot={{ r: 4, fill: t.series.primary }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-muted-foreground mt-2 text-center">
        Linha verde = meta de 70% de acerto
      </p>
    </div>
  );
}
