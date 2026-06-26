"use client";

interface Props {
  diasRestantes: number;
}

export default function CountdownWidget({ diasRestantes }: Props) {
  return (
    <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-8 mb-8 text-white text-center">
      <div className="text-8xl font-black tabular-nums leading-none mb-2">
        {diasRestantes}
      </div>
      <div className="text-xl font-medium text-blue-100 mb-1">
        {diasRestantes === 1 ? "dia" : "dias"} para a prova
      </div>
      <div className="text-sm text-blue-200">
        OAB 1ª Fase — 06 de setembro de 2026
      </div>
      {diasRestantes <= 30 && (
        <div className="mt-4 bg-white/20 rounded-lg px-4 py-2 text-sm font-medium">
          Reta final — foco total
        </div>
      )}
    </div>
  );
}
