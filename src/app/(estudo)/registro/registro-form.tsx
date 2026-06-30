"use client";

// Formulário de registro manual de estudo — Cockpit Drop 1.5, Fatia 1.
// Fatia 1: entrada MANUAL (matéria/subtema, local, tipo, minutos, anotação).
// Fatia 2: timer start/stop + seletor de material_id.

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { registrarEstudo } from "@/app/(estudo)/_actions/estudo.actions";
import type { TipoEstudo, Material } from "@/lib/types/domain";

// ---------------------------------------------------------------------------
// Tipos de props
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

interface RegistroFormProps {
  materias: Materia[];
  subtemas: Subtema[];
  materiais: Material[];
}

// ---------------------------------------------------------------------------
// Constantes de UI
// ---------------------------------------------------------------------------

const TIPO_OPCOES: Array<{ value: TipoEstudo; label: string }> = [
  { value: "leitura",  label: "Leitura" },
  { value: "video",    label: "Vídeo" },
  { value: "resumo",   label: "Resumo" },
  { value: "revisao",  label: "Revisão" },
  { value: "questoes", label: "Questões" },
  { value: "outro",    label: "Outro" },
];

// ---------------------------------------------------------------------------
// Estado inicial
// ---------------------------------------------------------------------------

interface FormState {
  materiaId:  string;
  subtemaId:  string;
  materialId: string;
  local:      string;
  tipoEstudo: TipoEstudo;
  minutos:    string;
  anotacao:   string;
}

const ESTADO_INICIAL: FormState = {
  materiaId:  "",
  subtemaId:  "",
  materialId: "",
  local:      "",
  tipoEstudo: "leitura",
  minutos:    "",
  anotacao:   "",
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function RegistroForm({ materias, subtemas, materiais }: RegistroFormProps) {
  const [form, setForm]         = useState<FormState>(ESTADO_INICIAL);
  const [erro, setErro]         = useState<string | null>(null);
  const [sucesso, setSucesso]   = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();

  // Subtemas filtrados pela matéria selecionada
  const subtemasFiltrados = form.materiaId
    ? subtemas.filter((s) => s.materiaId === form.materiaId)
    : [];

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Limpa subtema quando muda a matéria
      if (key === "materiaId") next.subtemaId = "";
      return next;
    });
    setSucesso(false);
    setErro(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    setSucesso(false);

    const minutos = parseInt(form.minutos, 10);
    if (!form.materiaId) {
      setErro("Selecione a matéria.");
      return;
    }
    if (isNaN(minutos) || minutos < 1) {
      setErro("Informe um tempo válido (mínimo 1 minuto).");
      return;
    }

    startTransition(async () => {
      const resultado = await registrarEstudo({
        materiaId:  form.materiaId,
        subtemaId:  form.subtemaId  || undefined,
        materialId: form.materialId || undefined,
        local:      form.local.trim()   || undefined,
        tipoEstudo: form.tipoEstudo,
        minutos,
        anotacao:   form.anotacao.trim() || undefined,
      });

      if (resultado.ok) {
        setSucesso(true);
        setForm(ESTADO_INICIAL);
      } else {
        setErro(resultado.erro);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Matéria (obrigatória) */}
      <div className="flex flex-col gap-1">
        <label htmlFor="materia" className="text-sm font-medium text-foreground">
          Matéria <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <select
          id="materia"
          value={form.materiaId}
          onChange={(e) => setField("materiaId", e.target.value)}
          required
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="">Selecione uma matéria…</option>
          {materias.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome.length > 60 ? m.nome.slice(0, 58) + "…" : m.nome}
            </option>
          ))}
        </select>
      </div>

      {/* Subtema (opcional — só aparece se a matéria tiver subtemas) */}
      {subtemasFiltrados.length > 0 && (
        <div className="flex flex-col gap-1">
          <label htmlFor="subtema" className="text-sm font-medium text-foreground">
            Subtema <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <select
            id="subtema"
            value={form.subtemaId}
            onChange={(e) => setField("subtemaId", e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Selecione um subtema…</option>
            {subtemasFiltrados.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Material (opcional) */}
      {materiais.length > 0 && (
        <div className="flex flex-col gap-1">
          <label htmlFor="material" className="text-sm font-medium text-foreground">
            Material <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <select
            id="material"
            value={form.materialId}
            onChange={(e) => setField("materialId", e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Selecione um material…</option>
            {materiais.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome.length > 60 ? m.nome.slice(0, 58) + "…" : m.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tipo de estudo + Local — linha dupla */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="tipo" className="text-sm font-medium text-foreground">
            Tipo de estudo
          </label>
          <select
            id="tipo"
            value={form.tipoEstudo}
            onChange={(e) => setField("tipoEstudo", e.target.value as TipoEstudo)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {TIPO_OPCOES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="local" className="text-sm font-medium text-foreground">
            Local <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <input
            id="local"
            type="text"
            placeholder="Ex: casa, faculdade…"
            maxLength={200}
            value={form.local}
            onChange={(e) => setField("local", e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Minutos (obrigatório) */}
      <div className="flex flex-col gap-1">
        <label htmlFor="minutos" className="text-sm font-medium text-foreground">
          Tempo estudado (minutos) <span className="text-red-500 dark:text-red-400">*</span>
        </label>
        <input
          id="minutos"
          type="number"
          min={1}
          max={720}
          step={1}
          placeholder="Ex: 45"
          value={form.minutos}
          onChange={(e) => setField("minutos", e.target.value)}
          required
          className="w-40 rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <p className="text-xs text-muted-foreground">Use o timer nos blocos do Plano do Dia para registrar automaticamente.</p>
      </div>

      {/* Anotação (opcional) */}
      <div className="flex flex-col gap-1">
        <label htmlFor="anotacao" className="text-sm font-medium text-foreground">
          Anotação <span className="text-muted-foreground font-normal">(opcional)</span>
        </label>
        <textarea
          id="anotacao"
          rows={3}
          maxLength={2000}
          placeholder="O que você estudou? Dificuldades? Próximos passos?"
          value={form.anotacao}
          onChange={(e) => setField("anotacao", e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring resize-none"
        />
      </div>

      {/* Feedback */}
      {erro && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
          {erro}
        </p>
      )}
      {sucesso && (
        <p className="text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-lg px-3 py-2">
          Sessão registrada com sucesso.
        </p>
      )}

      {/* Submit */}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Registrando…" : "Registrar sessão"}
      </Button>
    </form>
  );
}
