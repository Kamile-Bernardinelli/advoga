"use client";

// [client] Headline recharts — top-15 subtemas por INCIDÊNCIA (spec §4.3).
// Espelha grafico-materias.tsx, mas com COR ÚNICA neutra (#6366f1 indigo): aqui a barra mede
// VOLUME do corpus, não desempenho — colorir por valor implicaria juízo (anti-chute §7).
// Sem paleta verde/âmbar/vermelho. isAnimationActive=false (convenção recharts do projeto).

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface IncidenciaChartItem {
  subtemaNome: string;
  materiaNome: string;
  incidencia: number;
  disponiveis: number;
}

interface Props {
  dados: IncidenciaChartItem[];
}

export default function GraficoIncidencia({ dados }: Props) {
  const data = dados.map((d) => ({
    nome: d.subtemaNome.length > 22 ? d.subtemaNome.slice(0, 20) + "…" : d.subtemaNome,
    nomeCompleto: d.subtemaNome,
    materiaNome: d.materiaNome,
    incidencia: d.incidencia,
    disponiveis: d.disponiveis,
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <ResponsiveContainer width="100%" height={360}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 32, left: 8, bottom: 4 }}
        >
          <XAxis
            type="number"
            domain={[0, "dataMax"]}
            allowDecimals={false}
            tick={{ fontSize: 10 }}
          />
          <YAxis
            type="category"
            dataKey="nome"
            width={170}
            tick={{ fontSize: 10 }}
          />
          <Tooltip
            formatter={(_value, _name, props) => {
              const p = props.payload;
              return [
                `${p.incidencia} questões (${p.disponiveis} respondíveis) — ${p.materiaNome}`,
                p.nomeCompleto,
              ];
            }}
          />
          <Bar
            dataKey="incidencia"
            fill="#6366f1"
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-400 mt-2 text-center">
        Volume histórico de questões por subtema (o que já caiu). Cor única = sem juízo de
        direção.
      </p>
    </div>
  );
}
