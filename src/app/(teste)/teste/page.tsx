// [RSC] Lista de provas/simulados disponíveis para iniciar
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import IniciarProvaForm from "./iniciar-prova-form";

export default async function TestePage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Busca exames disponíveis (sem gabarito — tabela exames não tem gabarito)
  const { data: exames, error } = await supabase
    .from("exames")
    .select("id, numero_romano, edicao, tipo_prova, data")
    .order("edicao", { ascending: false });

  if (error) {
    console.error("[TestePage] Erro ao buscar exames:", error);
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2 text-foreground">Provas e Simulados</h1>
      <p className="text-muted-foreground mb-6">
        Selecione uma prova para iniciar. O gabarito fica oculto até você finalizar.
      </p>

      {!exames || exames.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
          Nenhuma prova disponível. Execute o script de ingestão para carregar questões.
        </div>
      ) : (
        <div className="space-y-3">
          {exames.map((exame) => (
            <div
              key={exame.id}
              className="rounded-xl border border-border bg-card p-5 flex items-center justify-between hover:border-ring transition-colors"
            >
              <div>
                <div className="font-semibold text-foreground">
                  {exame.numero_romano
                    ? `OAB ${exame.numero_romano} Exame`
                    : `OAB ${exame.edicao}º Exame`}
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  {exame.tipo_prova === "prova_oficial" ? "Prova Oficial" :
                   exame.tipo_prova === "simulado" ? "Simulado" : "Reaplicação"}
                  {exame.data ? ` · ${new Date(exame.data).getFullYear()}` : ""}
                </div>
              </div>
              <IniciarProvaForm exameId={exame.id} tipo={exame.tipo_prova} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
