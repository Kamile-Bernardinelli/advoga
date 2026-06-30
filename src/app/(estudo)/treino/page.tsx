// [RSC] Pré-tela de treino focado por subtema (Drop 2.5)
// Lê ?subtema=UUID, conta disponíveis e renderiza o form de início.
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import IniciarTreinoForm from "./iniciar-treino-form";

interface Props { searchParams: Promise<{ subtema?: string }>; }

export default async function TreinoPage({ searchParams }: Props) {
  const { subtema } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Sem subtema: explica de onde vir + atalho p/ prova inteira
  if (!subtema) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Treino Focado</h1>
        <p className="text-muted-foreground mb-4">
          Abra um bloco de <strong>Questões</strong> no seu{" "}
          <Link href="/plano" className="text-blue-600 dark:text-blue-400 underline">plano do dia</Link> para treinar o subtema priorizado,
          ou faça uma <Link href="/teste" className="text-blue-600 dark:text-blue-400 underline">prova/simulado completo</Link>.
        </p>
      </div>
    );
  }

  // Busca nome do subtema + matéria-pai
  const { data: sub } = await supabase
    .from("subtemas")
    .select("id, nome, materias:materia_id(nome)")
    .eq("id", subtema)
    .single();

  // Conta questões respondíveis (honestidade do loop)
  const { count } = await supabase
    .from("questoes_prova")
    .select("id", { count: "exact", head: true })
    .eq("subtema_id", subtema);

  const materiaNome = (sub?.materias as { nome: string } | null)?.nome ?? "Matéria";
  const disponiveis = count ?? 0;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <p className="text-xs text-muted-foreground">{materiaNome} ›</p>
      <h1 className="text-2xl font-bold mb-2">{sub?.nome ?? "Subtema"}</h1>
      {disponiveis > 0 ? (
        <>
          <p className="text-muted-foreground mb-6">{disponiveis} questões disponíveis deste subtema.</p>
          <IniciarTreinoForm subtemaId={subtema} />
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-6 text-amber-800 dark:text-amber-300 text-sm">
          Ainda não há questões respondíveis deste subtema (serão adensadas no próximo backfill).
          Estude o conteúdo e volte depois.
        </div>
      )}
    </div>
  );
}
