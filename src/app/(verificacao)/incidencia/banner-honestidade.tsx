// [RSC] Banner de honestidade — o coração do anti-chute (spec §4.1).
// Não-dismissível, acima dos dados. Estilo informativo NEUTRO (âmbar, não vermelho de alarme).
// Texto fixo PT-BR: incidência é estável, rotação foi testada e rejeitada, painel é DESCRITIVO.
// Base: docs/analysis/tendencia-subtema-findings.md (§4–§5).

export function BannerHonestidade({ edMin, edMax }: { edMin: number; edMax: number }) {
  return (
    <div
      role="note"
      className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 mb-6 text-sm text-amber-900 dark:text-amber-200"
    >
      <p className="font-semibold">Incidência estável — sem rotação detectável.</p>
      <p className="mt-1.5 leading-relaxed">
        A incidência por subtema é <strong>estável</strong> na janela analisada (edições{" "}
        <strong>
          {edMin}–{edMax}
        </strong>
        ). Testamos a hipótese de a FGV &ldquo;rotacionar&rdquo; subtemas (um esfria, outro
        esquenta) com um <strong>teste de permutação (5000 reamostragens)</strong> e ela{" "}
        <strong>não se sustenta</strong>: o movimento observado é{" "}
        <strong>igual ou menor que o do acaso</strong>.
      </p>
      <p className="mt-1.5 leading-relaxed">
        Este painel é <strong>descritivo</strong> — mostra o que <strong>já caiu</strong>, não
        prevê o que <strong>vai cair</strong>. Use a incidência para priorizar{" "}
        <strong>volume histórico</strong>; <strong>não existe subtema &ldquo;na vez&rdquo;</strong>.
      </p>
      <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
        Base: análise <code>docs/analysis/tendencia-subtema-findings.md</code> (ed38–46, 640
        questões).
      </p>
    </div>
  );
}
