"use client";

interface Props {
  diasRestantes: number;
}

export default function CountdownWidget({ diasRestantes }: Props) {
  // Hero acentuado com o token de marca (--primary indigo) — adapta claro/escuro
  // sozinho. O gradiente usa alpha sobre o próprio primary (sutil nos 2 temas).
  return (
    <div className="bg-gradient-to-br from-primary to-primary/85 rounded-2xl p-8 mb-8 text-primary-foreground text-center shadow-sm">
      <div className="text-8xl font-black tabular-nums leading-none mb-2">
        {diasRestantes}
      </div>
      <div className="text-xl font-medium text-primary-foreground/80 mb-1">
        {diasRestantes === 1 ? "dia" : "dias"} para a prova
      </div>
      <div className="text-sm text-primary-foreground/70">
        OAB 1ª Fase — 06 de setembro de 2026
      </div>
      {diasRestantes <= 30 && (
        <div className="mt-4 bg-primary-foreground/15 rounded-lg px-4 py-2 text-sm font-medium">
          Reta final — foco total
        </div>
      )}
    </div>
  );
}
