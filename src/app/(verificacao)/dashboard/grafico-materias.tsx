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
  nome: string;
  taxa: number;
  n_feitas: number;
  n_acertos: number;
  amostra_suficiente: boolean;
}

interface Props {
  materias: Materia[];
}

function getBarColor(taxa: number): string {
  if (taxa >= 70) return "#16a34a";
  if (taxa >= 50) return "#d97706";
  return "#dc2626";
}

export default function GraficoMaterias({ materias }: Props) {
  const dados = materias
    .filter((m) => m.n_feitas > 0)
    .map((m) => ({
      nome: m.nome.length > 22 ? m.nome.slice(0, 20) + "…" : m.nome,
      nomeCompleto: m.nome,
      taxa: m.taxa,
      n_feitas: m.n_feitas,
      n_acertos: m.n_acertos,
      amostra_suficiente: m.amostra_suficiente,
    }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={dados}
          layout="vertical"
          margin={{ top: 4, right: 44, left: 8, bottom: 4 }}
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            type="category"
            dataKey="nome"
            width={150}
            tick={{ fontSize: 10 }}
          />
          <Tooltip
            formatter={(value, _name, props) => {
              const p = props.payload;
              const suffix = !p.amostra_suficiente ? " (insuf.)" : "";
              return [`${value}% (${p.n_acertos}/${p.n_feitas})${suffix}`, p.nomeCompleto];
            }}
          />
          <Bar dataKey="taxa" radius={[0, 4, 4, 0]}>
            {dados.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.amostra_suficiente ? getBarColor(entry.taxa) : "#9ca3af"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-400 mt-2 text-center">
        Cinza = amostra insuficiente ({"<"} 8 questões)
      </p>
    </div>
  );
}
