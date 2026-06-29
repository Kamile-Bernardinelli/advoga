// [RSC] Mini-barras CSS por edição (spec §4.5, decisão D2-B).
// Sem "use client", sem animação. Cor ÚNICA slate-300 (nunca por direção subiu/desceu) — guardrail
// anti-chute §7. `max` é o maxSerie GLOBAL → barras comparáveis entre linhas → a PLANURA aparece.
// Célula 0 → barra de altura 0 sobre a baseline (leitura honesta da esparsidade densificada).

export function SparklineEdicoes({
  serie,
  edicoes,
  max,
}: {
  serie: number[];
  edicoes: number[];
  max: number;
}) {
  return (
    <div
      className="flex items-end gap-0.5 h-9 border-b border-gray-100"
      role="img"
      aria-label={`Questões por edição: ${serie.join(", ")}`}
    >
      {serie.map((v, i) => (
        <div
          key={edicoes[i]}
          title={`Ed. ${edicoes[i]}: ${v} ${v === 1 ? "questão" : "questões"}`}
          className="w-2 bg-slate-300 rounded-t-sm shrink-0"
          style={{ height: max > 0 ? `${(v / max) * 100}%` : "0%" }}
        />
      ))}
    </div>
  );
}
