// [RSC] Pós-finalize: acertos/erros por matéria+subtema + gabarito liberado
// O gabarito SÓ aparece aqui, DEPOIS do finalizeSession ter corrigido no servidor.
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ResultadoGrafico from "./resultado-grafico";

interface ResultadoPageProps {
  params: Promise<{ sessaoId: string }>;
}

interface RespostaComQuestao {
  id: string;
  questao_id: string;
  resposta_dada: string | null;
  correta: boolean | null;
  tempo_seg: number | null;
  questoes: {
    enunciado: string;
    alt_a: string;
    alt_b: string;
    alt_c: string;
    alt_d: string;
    gabarito: string;
    validade_status: string;
    materia_id: string | null;
    subtema_id: string | null;
    materias?: { id: string; nome: string } | null;
    subtemas?: { id: string; nome: string } | null;
  } | null;
}

export default async function ResultadoPage({ params }: ResultadoPageProps) {
  const { sessaoId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Verifica sessão
  const { data: sessao, error: sessaoError } = await supabase
    .from("sessoes")
    .select("id, exame_id, tipo, inicio, fim")
    .eq("id", sessaoId)
    .eq("user_id", user.id)
    .single();

  if (sessaoError || !sessao) {
    redirect("/teste");
  }

  // Sessão não finalizada — redireciona de volta para a prova
  if (!sessao.fim) {
    redirect(`/teste/${sessaoId}`);
  }

  // Busca respostas corrigidas com gabarito (só pós-finalize)
  const { data: respostas, error: respostasError } = await supabase
    .from("respostas")
    .select(`
      id,
      questao_id,
      resposta_dada,
      correta,
      tempo_seg,
      questoes (
        enunciado,
        alt_a,
        alt_b,
        alt_c,
        alt_d,
        gabarito,
        validade_status,
        materia_id,
        subtema_id,
        materias ( id, nome ),
        subtemas ( id, nome )
      )
    `)
    .eq("sessao_id", sessaoId)
    .order("created_at");

  if (respostasError) {
    console.error("[ResultadoPage] Erro ao buscar respostas:", respostasError);
  }

  const lista = (respostas ?? []) as unknown as RespostaComQuestao[];

  // Agrega por matéria
  const porMateria: Record<string, {
    nome: string;
    total: number;
    acertos: number;
    subtemas: Record<string, { nome: string; total: number; acertos: number }>;
  }> = {};

  let totalAcertos = 0;
  let totalErros = 0;
  let totalAnuladas = 0;

  for (const r of lista) {
    if (r.correta === null) continue;

    const q = r.questoes;
    const materiaId = q?.materia_id ?? "sem_materia";
    const materiaNome = q?.materias?.nome ?? "Classificação pendente";
    const subtemaId = q?.subtema_id ?? "sem_subtema";
    const subtemaNome = q?.subtemas?.nome ?? "Subtema pendente";
    const anulada = q?.validade_status === "anulada";

    if (anulada) {
      totalAnuladas++;
    } else if (r.correta) {
      totalAcertos++;
    } else {
      totalErros++;
    }

    if (!porMateria[materiaId]) {
      porMateria[materiaId] = { nome: materiaNome, total: 0, acertos: 0, subtemas: {} };
    }
    if (!anulada) {
      porMateria[materiaId].total++;
      if (r.correta) porMateria[materiaId].acertos++;
    }

    if (!porMateria[materiaId].subtemas[subtemaId]) {
      porMateria[materiaId].subtemas[subtemaId] = { nome: subtemaNome, total: 0, acertos: 0 };
    }
    if (!anulada) {
      porMateria[materiaId].subtemas[subtemaId].total++;
      if (r.correta) porMateria[materiaId].subtemas[subtemaId].acertos++;
    }
  }

  const totalNaoAnuladas = totalAcertos + totalErros;
  const percentualGeral = totalNaoAnuladas > 0
    ? Math.round((totalAcertos / totalNaoAnuladas) * 100)
    : 0;

  // Duração
  const duracaoSeg = sessao.fim
    ? Math.floor((new Date(sessao.fim).getTime() - new Date(sessao.inicio).getTime()) / 1000)
    : 0;
  const duracaoFormatada = `${Math.floor(duracaoSeg / 3600)}h ${Math.floor((duracaoSeg % 3600) / 60)}min`;

  // Ordena matérias por % de acerto (piores primeiro)
  const materiasOrdenadas = Object.entries(porMateria)
    .filter(([, m]) => m.total > 0)
    .map(([id, m]) => ({
      id,
      nome: m.nome,
      total: m.total,
      acertos: m.acertos,
      taxa: m.total > 0 ? m.acertos / m.total : 0,
      subtemas: Object.entries(m.subtemas)
        .filter(([, s]) => s.total > 0)
        .map(([sid, s]) => ({
          id: sid,
          nome: s.nome,
          total: s.total,
          acertos: s.acertos,
          taxa: s.total > 0 ? s.acertos / s.total : 0,
        }))
        .sort((a, b) => a.taxa - b.taxa),
    }))
    .sort((a, b) => a.taxa - b.taxa);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground mb-1">Resultado da Prova</h1>
        <p className="text-sm text-muted-foreground">Duração: {duracaoFormatada}</p>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <div className="text-3xl font-bold text-green-600 dark:text-green-400">{totalAcertos}</div>
          <div className="text-sm text-muted-foreground mt-1">Acertos</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <div className="text-3xl font-bold text-red-500 dark:text-red-400">{totalErros}</div>
          <div className="text-sm text-muted-foreground mt-1">Erros</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{percentualGeral}%</div>
          <div className="text-sm text-muted-foreground mt-1">Acertos geral</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{totalAnuladas}</div>
          <div className="text-sm text-muted-foreground mt-1">Anuladas</div>
        </div>
      </div>

      {/* Gráfico por matéria */}
      {materiasOrdenadas.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Desempenho por Matéria</h2>
          <ResultadoGrafico materias={materiasOrdenadas} />
        </div>
      )}

      {/* Breakdown por matéria com subtemas */}
      <div className="space-y-4 mb-8">
        <h2 className="text-lg font-semibold text-foreground">Detalhe por Matéria</h2>
        {materiasOrdenadas.map((m) => (
          <div key={m.id} className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <span className="font-medium text-foreground">{m.nome}</span>
                <span className="text-sm text-muted-foreground ml-2">({m.total} questões)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">
                  {m.acertos}/{m.total}
                </span>
                <span className={`font-bold text-lg ${m.taxa >= 0.7 ? "text-green-600 dark:text-green-400" : m.taxa >= 0.5 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                  {Math.round(m.taxa * 100)}%
                </span>
              </div>
            </div>
            {m.subtemas.length > 0 && (
              <div className="border-t border-border divide-y divide-border">
                {m.subtemas.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-5 py-2.5 pl-8">
                    <div>
                      <span className="text-sm text-foreground">{s.nome}</span>
                      {s.total < 8 && (
                        <span className="ml-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 rounded px-1.5 py-0.5">
                          amostra insuficiente ({s.total}/8 questões)
                        </span>
                      )}
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">{s.acertos}/{s.total}</span>
                      <span className={`ml-2 font-medium ${s.taxa >= 0.7 ? "text-green-600 dark:text-green-400" : s.taxa >= 0.5 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                        {Math.round(s.taxa * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Revisão questão-a-questão */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Revisão Questão-a-Questão</h2>
        <div className="space-y-4">
          {lista.map((r, idx) => {
            const q = r.questoes;
            if (!q) return null;
            const anulada = q.validade_status === "anulada";

            return (
              <div
                key={r.id}
                className={`bg-card rounded-xl border p-5 ${
                  anulada ? "border-yellow-300 dark:border-yellow-800" :
                  r.correta ? "border-green-300 dark:border-green-800" : "border-red-300 dark:border-red-900"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Questão {idx + 1}
                  </span>
                  <div className="flex gap-2">
                    {anulada && (
                      <span className="rounded-full bg-yellow-100 dark:bg-yellow-950/50 px-2.5 py-0.5 text-xs font-medium text-yellow-800 dark:text-yellow-300">
                        Anulada (FGV)
                      </span>
                    )}
                    {!anulada && (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${r.correta ? "bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-300" : "bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-300"}`}>
                        {r.correta ? "Correto" : "Errado"}
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-sm text-foreground mb-3 leading-relaxed">{q.enunciado}</p>

                <div className="space-y-1.5">
                  {(["A", "B", "C", "D"] as const).map((letra) => {
                    const texto = letra === "A" ? q.alt_a : letra === "B" ? q.alt_b : letra === "C" ? q.alt_c : q.alt_d;
                    const isGabarito = q.gabarito === letra;
                    const isResposta = r.resposta_dada === letra;

                    return (
                      <div
                        key={letra}
                        className={`rounded-lg px-3 py-2 text-sm flex items-start gap-2 ${
                          isGabarito ? "bg-green-50 dark:bg-green-950/30 border border-green-300 dark:border-green-800" :
                          isResposta && !isGabarito ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900" :
                          "bg-muted border border-border"
                        }`}
                      >
                        <span className={`font-bold flex-shrink-0 ${isGabarito ? "text-green-700 dark:text-green-300" : isResposta ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                          {letra})
                        </span>
                        <span className={isGabarito ? "text-green-800 dark:text-green-200" : isResposta ? "text-red-700 dark:text-red-300" : "text-muted-foreground"}>
                          {texto}
                          {isGabarito && <span className="ml-2 text-xs font-semibold text-green-700 dark:text-green-300">(Gabarito)</span>}
                          {isResposta && !isGabarito && <span className="ml-2 text-xs font-semibold text-red-600 dark:text-red-400">(Sua resposta)</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Link para voltar */}
      <div className="mt-8 text-center">
        <Link
          href="/teste"
          className="inline-flex items-center rounded-lg bg-primary text-white px-6 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Fazer outra prova
        </Link>
      </div>
    </div>
  );
}
