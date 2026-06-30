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

function getBarColor(taxa: number): string {
  if (taxa >= 0.7) return "#16a34a"; // verde
  if (taxa >= 0.5) return "#d97706"; // âmbar
  return "#dc2626"; // vermelho
}

export default function ResultadoGrafico({ materias }: Props) {
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
            tick={{ fontSize: 11 }}
          />
          <YAxis
            type="category"
            dataKey="nome"
            width={160}
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            formatter={(value, _name, props) => {
              const { acertos, total, nomeCompleto } = props.payload;
              return [`${value}% (${acertos}/${total})`, nomeCompleto];
            }}
          />
          <Bar dataKey="taxa" radius={[0, 4, 4, 0]}>
            {dados.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.taxa / 100)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-3 justify-center text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block bg-green-600" /> ≥ 70%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block bg-amber-600" /> 50–69%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block bg-red-600" /> &lt; 50%
        </span>
      </div>
    </div>
  );
}
