// [RSC] Registro de Estudo — Cockpit Drop 1.5, Fatia 1
// Carrega lista de matérias (para o form) e registros recentes.
// O RegistroForm (client) chama registrarEstudo() via Server Action.

import { createClient } from "@/lib/supabase/server";
import { listarEstudoRecente } from "@/app/(estudo)/_actions/estudo.actions";
import { listarMateriais } from "@/app/(estudo)/_actions/materiais.actions";
import { RegistroForm } from "./registro-form";

// ---------------------------------------------------------------------------
// Tipos para o select de matérias
// ---------------------------------------------------------------------------

interface Materia {
  id: string;
  nome: string;
}

interface Subtema {
  id: string;
  nome: string;
  materiaId: string;
}

// Raw rows do join
interface RawSubtema {
  id: string;
  nome: string;
  materia_id: string;
}

// ---------------------------------------------------------------------------
// Carrega dados de catálogo (RSC — leitura authenticated, sem RLS user_id)
// ---------------------------------------------------------------------------

async function fetchCatalogo(): Promise<{ materias: Materia[]; subtemas: Subtema[] }> {
  const client = await createClient();

  const [{ data: mData }, { data: sData }] = await Promise.all([
    client.from("materias").select("id, nome").order("nome"),
    client.from("subtemas").select("id, nome, materia_id").order("nome"),
  ]);

  const materias: Materia[] = (mData ?? []).map((m) => ({
    id:   m.id,
    nome: m.nome,
  }));

  const subtemas: Subtema[] = ((sData ?? []) as RawSubtema[]).map((s) => ({
    id:        s.id,
    nome:      s.nome,
    materiaId: s.materia_id,
  }));

  return { materias, subtemas };
}

// ---------------------------------------------------------------------------
// Componente de lista de registros recentes
// ---------------------------------------------------------------------------

import type { EstudoSessao } from "@/lib/types/domain";

const TIPO_LABEL: Record<string, string> = {
  leitura:  "Leitura",
  video:    "Vídeo",
  resumo:   "Resumo",
  revisao:  "Revisão",
  questoes: "Questões",
  outro:    "Outro",
};

function ListaRecente({ sessoes }: { sessoes: EstudoSessao[] }) {
  if (sessoes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic">
        Nenhum registro ainda. Use o formulário acima para começar a capturar seu tempo de estudo.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {sessoes.map((s) => (
        <div
          key={s.id}
          className="flex items-start justify-between rounded-lg border border-border bg-muted px-4 py-3"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {s.materiaNome ?? s.materiaId}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {TIPO_LABEL[s.tipoEstudo] ?? s.tipoEstudo}
              {s.local ? ` · ${s.local}` : ""}
              {s.anotacao ? ` · ${s.anotacao.slice(0, 60)}${s.anotacao.length > 60 ? "…" : ""}` : ""}
            </p>
          </div>
          <div className="ml-3 shrink-0 text-right">
            <span className="text-sm font-bold text-foreground">{s.duracaoMin} min</span>
            <p className="text-xs text-muted-foreground">
              {new Date(s.ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function RegistroPage() {
  const [{ materias, subtemas }, sessoes, materiais] = await Promise.all([
    fetchCatalogo(),
    listarEstudoRecente(15),
    listarMateriais(),
  ]);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1 text-foreground">Registrar Estudo</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        Informe o que estudou, por quanto tempo e onde. O sensor captura seu esforço
        para cruzar com os resultados das questões.
      </p>

      {/* Formulário de registro manual (Fatia 1 + material_id Fatia B) */}
      <RegistroForm materias={materias} subtemas={subtemas} materiais={materiais} />

      {/* Lista de registros recentes */}
      <section className="mt-10">
        <h2 className="text-base font-semibold text-foreground mb-3">Registros recentes</h2>
        <ListaRecente sessoes={sessoes} />
      </section>
    </div>
  );
}
