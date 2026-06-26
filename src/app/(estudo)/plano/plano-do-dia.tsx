"use client";

// Cockpit do Dia — client component (RSC passa dados; este atualiza localmente)
// Estrutura (de cima para baixo — §5.2 do spec v2):
//   1. Header de aderência (meta/real/saldo + barra mensal + ritmo/status)
//   2. Blocos de hoje (conteúdo + questões + revisão) com timer por bloco
//   3. Link para registrar manualmente
//
// PlanoControls/ExplicacaoPlano realocados para o bloco de questões (detalhe).
// gerarPlanoDiario / plano_diario permanecem intactos (capacidade preservada).

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TimerEstudo } from "@/components/estudo/timer-estudo";
import { marcarBlocoFeito } from "@/app/(estudo)/_actions/cronograma.actions";
import { definirOverrideDia } from "@/app/(estudo)/_actions/metas.actions";
import type { AderenciaHoje, CronogramaBloco, BlocoStatus } from "@/lib/types/domain";

// ---------------------------------------------------------------------------
// Tipos de props
// ---------------------------------------------------------------------------

interface PlanoDodiProps {
  aderencia: AderenciaHoje | null;
  blocos: CronogramaBloco[];
  hoje: string;  // YYYY-MM-DD no fuso da usuária
}

// ---------------------------------------------------------------------------
// Helpers UI
// ---------------------------------------------------------------------------

const TIPO_BADGE: Record<string, { label: string; cls: string }> = {
  conteudo: { label: "Conteúdo",  cls: "bg-blue-50 text-blue-700 border-blue-200" },
  questoes: { label: "Questões",  cls: "bg-purple-50 text-purple-700 border-purple-200" },
  revisao:  { label: "Revisão",   cls: "bg-amber-50 text-amber-700 border-amber-200" },
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  adiantada: { label: "Adiantada",  cls: "text-green-700 bg-green-50 border-green-200" },
  no_ritmo:  { label: "No ritmo",   cls: "text-blue-700 bg-blue-50 border-blue-200" },
  atrasada:  { label: "Atrasada",   cls: "text-red-700 bg-red-50 border-red-200" },
};

function formatarMin(min: number): string {
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  const sinal = min < 0 ? "−" : "+";
  if (h === 0) return `${sinal}${m}min`;
  if (m === 0) return `${sinal}${h}h`;
  return `${sinal}${h}h${m}min`;
}

function barra(pct: number): number {
  return Math.min(100, Math.max(0, Math.round(pct)));
}

// ---------------------------------------------------------------------------
// Sub-componente: Header de Aderência
// ---------------------------------------------------------------------------

interface HeaderAderenciaProps {
  aderencia: AderenciaHoje;
  hoje: string;
  onOverrideSet: () => void;
}

function HeaderAderencia({ aderencia, hoje, onOverrideSet }: HeaderAderenciaProps) {
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [novoMin, setNovoMin] = useState<string>(String(aderencia.metaHojeMin));
  const [erro, setErro] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    metaHojeMin, realHojeMin, saldoHojeMin,
    saldoAcumMesMin, realMesMin, metaMensalMin,
    diasRestantesMes, ritmoNecessarioMin, status,
  } = aderencia;

  const pctMensal = metaMensalMin && metaMensalMin > 0
    ? Math.round((realMesMin / metaMensalMin) * 100)
    : null;

  const statusBadge = STATUS_BADGE[status] ?? STATUS_BADGE.no_ritmo;

  function handleSalvarMeta() {
    const min = parseInt(novoMin, 10);
    if (isNaN(min) || min < 0) { setErro("Valor inválido."); return; }
    setErro(null);
    startTransition(async () => {
      const res = await definirOverrideDia(hoje, min, "ajuste manual");
      if (!res.ok) { setErro(res.erro); return; }
      setEditandoMeta(false);
      onOverrideSet();
    });
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      {/* Linha 1: Meta de hoje + Saldo */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Meta de hoje</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-gray-900">{metaHojeMin}min</span>
            {!editandoMeta && (
              <button
                type="button"
                onClick={() => setEditandoMeta(true)}
                className="text-xs text-blue-600 underline underline-offset-2 hover:text-blue-800"
              >
                ajustar
              </button>
            )}
          </div>
          {editandoMeta && (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                min={0}
                max={1440}
                value={novoMin}
                onChange={(e) => setNovoMin(e.target.value)}
                className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={handleSalvarMeta}
                disabled={isPending}
                className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isPending ? "…" : "Salvar"}
              </button>
              <button
                type="button"
                onClick={() => { setEditandoMeta(false); setErro(null); }}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Cancelar
              </button>
            </div>
          )}
          {erro && <p className="text-xs text-red-600 mt-1">{erro}</p>}
        </div>

        <div className="text-right">
          <p className="text-xs text-gray-500 mb-0.5">Hoje</p>
          <span className="text-2xl font-bold text-gray-900">{realHojeMin}min</span>
          <p className={`text-sm font-medium mt-0.5 ${saldoHojeMin >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatarMin(saldoHojeMin)}
          </p>
        </div>
      </div>

      {/* Linha 2: Saldo acumulado do mês */}
      {metaMensalMin != null && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>No mês:</span>
          <span className={saldoAcumMesMin >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
            {formatarMin(saldoAcumMesMin)}
          </span>
          <span className="text-gray-400">·</span>
          <span
            className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${statusBadge.cls}`}
          >
            {statusBadge.label}
          </span>
        </div>
      )}

      {/* Linha 3: Barra da meta mensal */}
      {metaMensalMin != null && metaMensalMin > 0 && pctMensal !== null && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>{realMesMin}min de {metaMensalMin}min ({pctMensal}%)</span>
            {diasRestantesMes > 0 && (
              <span>
                faltam {metaMensalMin - realMesMin > 0 ? metaMensalMin - realMesMin : 0}min
                {" "}em {diasRestantesMes}d = {ritmoNecessarioMin}min/dia
              </span>
            )}
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pctMensal >= 100 ? "bg-green-500" : "bg-blue-500"}`}
              style={{ width: `${barra(pctMensal)}%` }}
            />
          </div>
        </div>
      )}

      {/* Sem meta mensal: exibir apenas progresso */}
      {metaMensalMin == null && (
        <p className="text-xs text-gray-400">
          Defina uma meta mensal em{" "}
          <Link href="/cronograma" className="underline underline-offset-2 text-blue-600">
            Cronograma
          </Link>{" "}
          para ver o progresso do contrato.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-componente: Card de Bloco
// ---------------------------------------------------------------------------

interface BlocoCardProps {
  bloco: CronogramaBloco;
  onStatusChange: (id: string, status: BlocoStatus) => void;
  onLogged: () => void;
}

function BlocoCard({ bloco, onStatusChange, onLogged }: BlocoCardProps) {
  const [isPending, startTransition] = useTransition();
  const tipoBadge = TIPO_BADGE[bloco.tipo] ?? TIPO_BADGE.conteudo;

  const feito = bloco.status === "feito";

  function handleToggleFeito() {
    const novoStatus: BlocoStatus = feito ? "pendente" : "feito";
    onStatusChange(bloco.id, novoStatus);
    startTransition(async () => {
      await marcarBlocoFeito(bloco.id, novoStatus);
    });
  }

  return (
    <div
      className={`rounded-lg border p-4 transition-opacity ${
        feito ? "opacity-60 bg-gray-50 border-gray-200" : "bg-white border-gray-200 shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Info do bloco */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className={`inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium ${tipoBadge.cls}`}
            >
              {tipoBadge.label}
            </span>
            <span className="text-xs text-gray-400">{bloco.minutosAlvo}min</span>
            {bloco.status === "em_andamento" && (
              <span className="text-xs text-blue-600 font-medium">em andamento</span>
            )}
          </div>
          <p className="font-medium text-gray-900 text-sm">
            {bloco.materiaNome ?? bloco.materiaId.slice(0, 8)}
          </p>
          {bloco.subtemaNome && (
            <p className="text-xs text-gray-500 mt-0.5">{bloco.subtemaNome}</p>
          )}

          {/* Bloco de questões: link para /treino */}
          {bloco.tipo === "questoes" && (
            <Link
              href="/treino"
              className="inline-block mt-2 text-xs text-purple-700 underline underline-offset-2 hover:text-purple-900"
            >
              Ir para treino de questoes
            </Link>
          )}
        </div>

        {/* Checkbox feito */}
        <button
          type="button"
          onClick={handleToggleFeito}
          disabled={isPending}
          title={feito ? "Marcar como pendente" : "Marcar como feito"}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
            feito
              ? "bg-green-500 border-green-500 text-white"
              : "border-gray-300 bg-white hover:border-green-400"
          } disabled:opacity-50`}
        >
          {feito && <span className="text-xs">✓</span>}
        </button>
      </div>

      {/* Timer amarrado ao bloco */}
      {!feito && bloco.materiaId && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <TimerEstudo
            materiaId={bloco.materiaId}
            materiaNome={bloco.materiaNome ?? "Matéria"}
            subtemaId={bloco.subtemaId ?? undefined}
            tipoEstudo={bloco.tipo === "questoes" ? "questoes" : bloco.tipo === "revisao" ? "revisao" : "leitura"}
            blocoId={bloco.id}
            minutosAlvo={bloco.minutosAlvo}
            onLogged={onLogged}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal: PlanoDodia
// ---------------------------------------------------------------------------

export function PlanoDodia({ aderencia, blocos: blocosIniciais, hoje }: PlanoDodiProps) {
  const router = useRouter();
  const [blocos, setBlocos] = useState<CronogramaBloco[]>(blocosIniciais);

  function handleStatusChange(id: string, status: BlocoStatus) {
    setBlocos((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
  }

  function handleLogged() {
    // Refresh do RSC para atualizar o saldo no header
    router.refresh();
  }

  const temBlocos = blocos.length > 0;
  const totalHoje = blocos.reduce((s, b) => s + b.minutosAlvo, 0);
  const feitoHoje = blocos.filter((b) => b.status === "feito").reduce((s, b) => s + b.minutosAlvo, 0);

  return (
    <div className="space-y-6">
      {/* 1. Header de aderência */}
      {aderencia ? (
        <HeaderAderencia
          aderencia={aderencia}
          hoje={hoje}
          onOverrideSet={handleLogged}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5 text-sm text-gray-500">
          Configure sua meta base em{" "}
          <Link href="/cronograma" className="underline text-blue-600">
            Cronograma
          </Link>{" "}
          para ver o saldo de aderência.
        </div>
      )}

      {/* 2. Resumo do dia (blocos) */}
      {temBlocos && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span className="font-medium text-gray-900">Blocos de hoje</span>
          <span>
            {feitoHoje}min / {totalHoje}min concluídos
          </span>
        </div>
      )}

      {/* 3. Cards dos blocos */}
      {temBlocos ? (
        <div className="space-y-3">
          {blocos.map((b) => (
            <BlocoCard
              key={b.id}
              bloco={b}
              onStatusChange={handleStatusChange}
              onLogged={handleLogged}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
          <p className="text-gray-500 text-sm">Sem blocos para hoje.</p>
          <p className="text-xs text-gray-400 mt-1">
            Gere seu roteiro em{" "}
            <Link href="/cronograma" className="text-blue-600 underline underline-offset-2">
              Cronograma
            </Link>
            .
          </p>
        </div>
      )}

      {/* 4. Link para registro manual */}
      <div className="pt-2 border-t border-gray-100">
        <Link
          href="/registro"
          className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
        >
          Registrar sessao manualmente
        </Link>
      </div>
    </div>
  );
}
