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
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart
          data={dados}
          margin={{ top: 8, right: 16, left: 8, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="data"
            tick={{ fontSize: 10 }}
            tickFormatter={(v: string) => v.slice(5)} // MM-DD
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 10 }}
          />
          <Tooltip
            formatter={(value, _name, props) => {
              const p = props.payload;
              return [`${value}% (${p.acertos}/${p.total})`, "Taxa de acerto"];
            }}
            labelFormatter={(label) => `Data: ${label}`}
          />
          <ReferenceLine y={70} stroke="#16a34a" strokeDasharray="4 2" label={{ value: "70%", fill: "#16a34a", fontSize: 10 }} />
          <Line
            type="monotone"
            dataKey="taxa"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 4, fill: "#2563eb" }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-400 mt-2 text-center">
        Linha verde = meta de 70% de acerto
      </p>
    </div>
  );
}
