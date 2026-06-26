// [RSC] Tela de prova ativa
// Carrega questões via view questoes_prova (SEM gabarito) — segurança estrutural
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProvaRunner from "./prova-runner";
import { COLUNAS_QUESTAO_PROVA } from "@/lib/teste/colunas-prova";
import type { Database } from "@/lib/types/db.types";

interface Props {
  params: Promise<{ sessaoId: string }>;
}

export default async function ProvaPage({ params }: Props) {
  const { sessaoId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Verifica se a sessão existe e pertence ao usuário
  const { data: sessao, error: sessaoError } = await supabase
    .from("sessoes")
    .select("id, exame_id, tipo, inicio, fim")
    .eq("id", sessaoId)
    .eq("user_id", user.id)
    .single();

  if (sessaoError || !sessao) {
    redirect("/teste");
  }

  // Sessão já finalizada → redireciona para resultado
  if (sessao.fim) {
    redirect(`/resultado/${sessaoId}`);
  }

  // exame_id é nullable no schema (FK opcional), mas sessões ativas sempre têm exame_id.
  // Guard defensivo: se por algum motivo for null, redireciona.
  if (!sessao.exame_id) {
    redirect("/teste");
  }

  // Busca questões via VIEW sem gabarito (fronteira de segurança).
  // COLUNAS_QUESTAO_PROVA é a única fonte de verdade das colunas permitidas — gabarito nunca entra.
  // O cast explícito preserva a tipagem após o select com string dinâmica.
  const questoesResult = await supabase
    .from("questoes_prova")
    .select(COLUNAS_QUESTAO_PROVA.join(", "))
    .eq("exame_id", sessao.exame_id)
    .order("num_prova", { ascending: true });

  const questoesError = questoesResult.error;
  const questoesRaw = questoesResult.data as
    | Database["public"]["Views"]["questoes_prova"]["Row"][]
    | null;

  if (questoesError) {
    console.error("[ProvaPage] Erro ao buscar questões:", questoesError);
    redirect("/teste");
  }

  // A view questoes_prova reflete questoes (NOT NULL na tabela), mas o tipo da view
  // expõe nullable. Filtra registros com campos obrigatórios ausentes (impossível em runtime)
  // para narrowing seguro até o componente ProvaRunner.
  const questoes = (questoesRaw ?? []).filter(
    (q): q is typeof q & {
      id: string;
      enunciado: string;
      alt_a: string;
      alt_b: string;
      alt_c: string;
      alt_d: string;
      validade_status: string;
    } =>
      q.id !== null &&
      q.enunciado !== null &&
      q.alt_a !== null &&
      q.alt_b !== null &&
      q.alt_c !== null &&
      q.alt_d !== null &&
      q.validade_status !== null
  );

  // Busca respostas já salvas (para retomada de sessão)
  const { data: respostasExistentes } = await supabase
    .from("respostas")
    .select("questao_id, resposta_dada, tempo_seg")
    .eq("sessao_id", sessaoId);

  const respostasMap: Record<string, string | null> = {};
  for (const r of respostasExistentes ?? []) {
    respostasMap[r.questao_id] = r.resposta_dada;
  }

  return (
    <ProvaRunner
      sessaoId={sessaoId}
      questoes={questoes}
      respostasIniciais={respostasMap}
      inicio={sessao.inicio}
    />
  );
}
