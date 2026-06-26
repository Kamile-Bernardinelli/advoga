"use client";

// CRUD de materiais de estudo — client component.
// Permite criar, editar (inline) e remover materiais do catálogo.

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  criarMaterial,
  atualizarMaterial,
  removerMaterial,
} from "@/app/(estudo)/_actions/materiais.actions";
import type { Material, MaterialTipo } from "@/lib/types/domain";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const TIPO_OPCOES: Array<{ value: MaterialTipo; label: string }> = [
  { value: "livro",   label: "Livro" },
  { value: "pdf",     label: "PDF" },
  { value: "video",   label: "Vídeo" },
  { value: "curso",   label: "Curso" },
  { value: "lei",     label: "Lei/Código" },
  { value: "resumo",  label: "Resumo" },
  { value: "outro",   label: "Outro" },
];

const TIPO_LABEL: Record<MaterialTipo, string> = {
  livro: "Livro", pdf: "PDF", video: "Vídeo",
  curso: "Curso", lei: "Lei/Código", resumo: "Resumo", outro: "Outro",
};

// ---------------------------------------------------------------------------
// Sub-componente: formulário de criação
// ---------------------------------------------------------------------------

interface FormCriarProps {
  onCriado: (material: Material) => void;
}

function FormCriar({ onCriado }: FormCriarProps) {
  const [nome, setNome]         = useState("");
  const [tipo, setTipo]         = useState<MaterialTipo>("outro");
  const [ref, setRef]           = useState("");
  const [erro, setErro]         = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      const res = await criarMaterial({ nome, tipo, referencia: ref.trim() || null });
      if (!res.ok) { setErro(res.erro); return; }
      // ID retornado pelo action; montamos o Material localmente para atualizar a lista
      if (res.id) {
        const agora = new Date().toISOString();
        onCriado({ id: res.id, userId: "", nome, tipo, referencia: ref.trim() || null, createdAt: agora, updatedAt: agora });
      }
      setNome(""); setTipo("outro"); setRef("");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 border border-dashed border-gray-300 rounded-xl bg-gray-50">
      <h3 className="text-sm font-semibold text-gray-700">Adicionar material</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Nome *</label>
          <input
            required
            maxLength={200}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Código Civil 2024"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as MaterialTipo)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
          >
            {TIPO_OPCOES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">
          Referência <span className="text-gray-400">(url, edição, capítulo — opcional)</span>
        </label>
        <input
          maxLength={500}
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="Ex: https://… ou Cap. 3, ed. 5"
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none"
        />
      </div>
      {erro && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>
      )}
      <Button type="submit" disabled={isPending || !nome.trim()}>
        {isPending ? "Salvando…" : "Adicionar"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Sub-componente: linha da lista com edição inline
// ---------------------------------------------------------------------------

interface LinhaProps {
  material: Material;
  onAtualizado: (m: Material) => void;
  onRemovido: (id: string) => void;
}

function LinhaMaterial({ material, onAtualizado, onRemovido }: LinhaProps) {
  const [editando, setEditando]   = useState(false);
  const [nome, setNome]           = useState(material.nome);
  const [tipo, setTipo]           = useState<MaterialTipo>(material.tipo);
  const [ref, setRef]             = useState(material.referencia ?? "");
  const [erro, setErro]           = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSalvar() {
    setErro(null);
    startTransition(async () => {
      const res = await atualizarMaterial(material.id, { nome, tipo, referencia: ref.trim() || null });
      if (!res.ok) { setErro(res.erro); return; }
      onAtualizado({ ...material, nome, tipo, referencia: ref.trim() || null });
      setEditando(false);
    });
  }

  function handleRemover() {
    if (!confirm(`Remover "${material.nome}"? As sessões de estudo registradas não serão afetadas.`)) return;
    startTransition(async () => {
      const res = await removerMaterial(material.id);
      if (!res.ok) { setErro(res.erro); return; }
      onRemovido(material.id);
    });
  }

  if (editando) {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="sm:col-span-2">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={200}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as MaterialTipo)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            {TIPO_OPCOES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          maxLength={500}
          placeholder="Referência (opcional)"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        {erro && <p className="text-xs text-red-600">{erro}</p>}
        <div className="flex gap-2">
          <Button type="button" onClick={handleSalvar} disabled={isPending || !nome.trim()}>
            {isPending ? "…" : "Salvar"}
          </Button>
          <button
            type="button"
            onClick={() => { setEditando(false); setErro(null); setNome(material.nome); setTipo(material.tipo); setRef(material.referencia ?? ""); }}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 bg-white p-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900 text-sm">{material.nome}</span>
          <span className="text-xs text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
            {TIPO_LABEL[material.tipo]}
          </span>
        </div>
        {material.referencia && (
          <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">
            {material.referencia.startsWith("http") ? (
              <a href={material.referencia} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                {material.referencia}
              </a>
            ) : material.referencia}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={handleRemover}
          disabled={isPending}
          className="text-xs text-red-500 hover:text-red-700 underline disabled:opacity-50"
        >
          Remover
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

interface MateriaisFormProps {
  inicial: Material[];
}

export function MateriaisForm({ inicial }: MateriaisFormProps) {
  const [materiais, setMateriais] = useState<Material[]>(inicial);

  function handleCriado(m: Material) {
    setMateriais((prev) => [...prev, m].sort((a, b) => a.nome.localeCompare(b.nome)));
  }

  function handleAtualizado(m: Material) {
    setMateriais((prev) => prev.map((x) => (x.id === m.id ? m : x)));
  }

  function handleRemovido(id: string) {
    setMateriais((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-6">
      <FormCriar onCriado={handleCriado} />

      {materiais.length === 0 ? (
        <p className="text-sm text-gray-400 italic text-center py-4">
          Nenhum material ainda. Adicione o primeiro acima.
        </p>
      ) : (
        <div className="space-y-2">
          {materiais.map((m) => (
            <LinhaMaterial
              key={m.id}
              material={m}
              onAtualizado={handleAtualizado}
              onRemovido={handleRemovido}
            />
          ))}
        </div>
      )}
    </div>
  );
}
