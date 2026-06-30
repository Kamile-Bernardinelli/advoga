"use client";

// Formulário de configuração de metas + overrides + compensação (Fatia B).
// Seções:
//   1. Config base (meta diária, mensal, dias de estudo, timezone)
//   2. Gráficos Recharts (real×meta por dia + anel mensal)
//   3. Calendário de overrides (lista + criar/limpar)
//   4. Compensação 1-clique (preview → aplicar)
//
// Dados chegam do RSC; atualizações via Server Actions.

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  definirMetaBase,
  definirMetaMensal,
  definirDiasEstudo,
  definirOverrideDia,
  removerOverrideDia,
} from "@/app/(estudo)/_actions/metas.actions";
import { regenerarCronograma } from "@/app/(estudo)/_actions/cronograma.actions";
import {
  previewCompensacao,
  aplicarCompensacao,
} from "@/app/(estudo)/_actions/compensacao.actions";
import { GraficoSaldoDias } from "@/components/estudo/grafico-saldo-dias";
import { GraficoProgressoMensal } from "@/components/estudo/grafico-progresso-mensal";
import type { MetasEstudo, MetaDiaria, SaldoDia, SaldoMes } from "@/lib/types/domain";
import type { PropostaCompensacao } from "@/lib/metas/saldo";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const DIAS_SEMANA = [
  { dow: 0, label: "Dom" },
  { dow: 1, label: "Seg" },
  { dow: 2, label: "Ter" },
  { dow: 3, label: "Qua" },
  { dow: 4, label: "Qui" },
  { dow: 5, label: "Sex" },
  { dow: 6, label: "Sab" },
];

const TIMEZONE_OPCOES = [
  { value: "America/Sao_Paulo",   label: "São Paulo (BRT, UTC−3)" },
  { value: "America/Manaus",       label: "Manaus (AMT, UTC−4)" },
  { value: "America/Belem",        label: "Belém (BRT, UTC−3)" },
  { value: "America/Fortaleza",    label: "Fortaleza (BRT, UTC−3)" },
  { value: "America/Recife",       label: "Recife (BRT, UTC−3)" },
  { value: "America/Cuiaba",       label: "Cuiabá (AMT, UTC−4)" },
  { value: "America/Porto_Velho",  label: "Porto Velho (AMT, UTC−4)" },
  { value: "America/Rio_Branco",   label: "Rio Branco (ACT, UTC−5)" },
  { value: "America/Noronha",      label: "Fernando de Noronha (FNT, UTC−2)" },
];

const STATUS_LABEL: Record<string, string> = {
  adiantada: "Adiantada",
  no_ritmo:  "No ritmo",
  atrasada:  "Atrasada",
};

const STATUS_COR: Record<string, string> = {
  adiantada: "text-green-600 dark:text-green-400",
  no_ritmo:  "text-blue-600 dark:text-blue-400",
  atrasada:  "text-red-600 dark:text-red-400",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatarMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}min`;
}

function dataBr(iso: string): string {
  const [y, mo, d] = iso.split("-");
  return `${d}/${mo}/${y}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MetasFormProps {
  metas: MetasEstudo | null;
  overrides: MetaDiaria[];
  saldosMes: SaldoDia[];
  saldoMensal: SaldoMes | null;
  hoje: string;
}

// ---------------------------------------------------------------------------
// Seção: Config Base
// ---------------------------------------------------------------------------

interface ConfigBaseProps {
  metas: MetasEstudo | null;
  onSalvo: () => void;
}

function ConfigBase({ metas, onSalvo }: ConfigBaseProps) {
  const [metaBase, setMetaBase]   = useState<string>(String(metas?.metaBaseDiariaMin ?? 180));
  const [metaMensal, setMetaMensal] = useState<string>(String(metas?.metaMensalMin ?? ""));
  const [diasEstudo, setDiasEstudo] = useState<number[]>(metas?.diasEstudo ?? [0, 1, 2, 3, 4, 5, 6]);
  const [tz, setTz]               = useState<string>(metas?.timezone ?? "America/Sao_Paulo");
  const [erro, setErro]           = useState<string | null>(null);
  const [ok, setOk]               = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();

  function toggleDia(dow: number) {
    setDiasEstudo((prev) =>
      prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow].sort()
    );
    setOk(false);
  }

  function handleSalvar() {
    setErro(null);
    setOk(false);
    const base = parseInt(metaBase, 10);
    const mensal = metaMensal.trim() === "" ? null : parseInt(metaMensal.trim(), 10);

    if (isNaN(base) || base < 0 || base > 1440) {
      setErro("Meta base inválida (0–1440 minutos).");
      return;
    }
    if (mensal !== null && (isNaN(mensal) || mensal < 0 || mensal > 44640)) {
      setErro("Meta mensal inválida (0–44640 minutos).");
      return;
    }

    startTransition(async () => {
      const [r1, r2, r3] = await Promise.all([
        definirMetaBase(base),
        definirMetaMensal(mensal),
        definirDiasEstudo(diasEstudo),
      ]);
      const erros = [r1, r2, r3].filter((r) => !r.ok).map((r) => (!r.ok ? r.erro : "")).join("; ");
      if (erros) { setErro(erros); return; }
      setOk(true);
      onSalvo();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-5">
      <h2 className="text-base font-semibold text-foreground">Configurar metas</h2>

      {/* Meta base diária */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">Meta base diária (min)</label>
          <input
            type="number"
            min={0}
            max={1440}
            step={15}
            value={metaBase}
            onChange={(e) => { setMetaBase(e.target.value); setOk(false); }}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">= {formatarMin(parseInt(metaBase, 10) || 0)}/dia</p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-foreground">
            Meta mensal (min) <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <input
            type="number"
            min={0}
            max={44640}
            step={60}
            placeholder="Ex: 3000"
            value={metaMensal}
            onChange={(e) => { setMetaMensal(e.target.value); setOk(false); }}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {metaMensal && !isNaN(parseInt(metaMensal, 10)) && (
            <p className="text-xs text-muted-foreground">= {formatarMin(parseInt(metaMensal, 10))}/mês</p>
          )}
        </div>
      </div>

      {/* Dias de estudo */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">Dias de estudo</label>
        <div className="flex gap-2 flex-wrap">
          {DIAS_SEMANA.map(({ dow, label }) => (
            <button
              key={dow}
              type="button"
              onClick={() => toggleDia(dow)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                diasEstudo.includes(dow)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-ring"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{diasEstudo.length} dias/semana selecionados</p>
      </div>

      {/* Timezone */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-foreground">Fuso horário</label>
        <select
          value={tz}
          onChange={(e) => { setTz(e.target.value); setOk(false); }}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm focus:border-ring focus:outline-none"
        >
          {TIMEZONE_OPCOES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Define como o &quot;dia&quot; é calculado — importante para o saldo ser correto.
        </p>
      </div>

      {erro && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">{erro}</p>
      )}
      {ok && (
        <p className="text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-lg px-3 py-2">
          Metas salvas.
        </p>
      )}

      <Button type="button" onClick={handleSalvar} disabled={isPending}>
        {isPending ? "Salvando…" : "Salvar metas"}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seção: Overrides de dias (lista + criar)
// ---------------------------------------------------------------------------

interface OverridesProps {
  overridesIniciais: MetaDiaria[];
  hoje: string;
  onAtualizado: () => void;
}

function SecaoOverrides({ overridesIniciais, hoje, onAtualizado }: OverridesProps) {
  const [overrides, setOverrides] = useState<MetaDiaria[]>(overridesIniciais);
  const [novaData, setNovaData]   = useState<string>("");
  const [novoMin, setNovoMin]     = useState<string>("");
  const [novaNota, setNovaNota]   = useState<string>("");
  const [erro, setErro]           = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdicionar() {
    if (!novaData) { setErro("Data obrigatória."); return; }
    const min = parseInt(novoMin, 10);
    if (isNaN(min) || min < 0 || min > 1440) { setErro("Minutos inválidos (0–1440)."); return; }
    setErro(null);

    startTransition(async () => {
      const res = await definirOverrideDia(novaData, min, novaNota.trim() || undefined);
      if (!res.ok) { setErro(res.erro); return; }
      // Atualiza estado local (remove existente para o mesmo dia + adiciona novo)
      const novo: MetaDiaria = {
        id: `local-${Date.now()}`, userId: "",
        data: novaData, minutosMeta: min, nota: novaNota.trim() || null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      setOverrides((prev) => [
        ...prev.filter((o) => o.data !== novaData),
        novo,
      ].sort((a, b) => a.data.localeCompare(b.data)));
      setNovaData(""); setNovoMin(""); setNovaNota("");
      onAtualizado();
    });
  }

  function handleRemover(data: string) {
    startTransition(async () => {
      const res = await removerOverrideDia(data);
      if (!res.ok) { setErro(res.erro); return; }
      setOverrides((prev) => prev.filter((o) => o.data !== data));
      onAtualizado();
    });
  }

  const overridesFuturos = overrides.filter((o) => o.data >= hoje);

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
      <h2 className="text-base font-semibold text-foreground">Overrides por dia</h2>
      <p className="text-xs text-muted-foreground">
        Defina uma meta específica para um dia (0 = folga explícita). Sobrescreve a base.
      </p>

      {/* Formulário de adição */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Data</label>
          <input
            type="date"
            value={novaData}
            min={hoje}
            onChange={(e) => setNovaData(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm focus:border-ring focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Minutos (0 = folga)</label>
          <input
            type="number"
            min={0}
            max={1440}
            step={15}
            placeholder="Ex: 240"
            value={novoMin}
            onChange={(e) => setNovoMin(e.target.value)}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm focus:border-ring focus:outline-none"
          />
        </div>
        <Button
          type="button"
          onClick={handleAdicionar}
          disabled={isPending || !novaData || novoMin === ""}
        >
          {isPending ? "…" : "Definir"}
        </Button>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Nota (opcional)</label>
        <input
          type="text"
          maxLength={200}
          placeholder="Ex: viagem, reunião…"
          value={novaNota}
          onChange={(e) => setNovaNota(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm focus:border-ring focus:outline-none"
        />
      </div>

      {erro && <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>}

      {/* Lista de overrides futuros */}
      {overridesFuturos.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Nenhum override definido.</p>
      ) : (
        <div className="space-y-1.5">
          {overridesFuturos.map((o) => (
            <div
              key={o.id}
              className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2 text-sm"
            >
              <div>
                <span className="font-medium text-foreground">{dataBr(o.data)}</span>
                <span className="mx-2 text-muted-foreground">—</span>
                <span className={o.minutosMeta === 0 ? "text-red-600 dark:text-red-400 font-medium" : "text-foreground"}>
                  {o.minutosMeta === 0 ? "Folga" : formatarMin(o.minutosMeta)}
                </span>
                {o.nota && (
                  <span className="ml-2 text-xs text-muted-foreground">{o.nota}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRemover(o.data)}
                disabled={isPending}
                className="text-xs text-red-400 hover:text-red-600 underline disabled:opacity-50"
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seção: Compensação
// ---------------------------------------------------------------------------

interface CompensacaoProps {
  onAplicado: () => void;
}

function SecaoCompensacao({ onAplicado }: CompensacaoProps) {
  const [proposta, setProposta]       = useState<PropostaCompensacao | null>(null);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [erroComp, setErroComp]       = useState<string | null>(null);
  const [okMsg, setOkMsg]             = useState<string | null>(null);
  const [isPending, startTransition]  = useTransition();

  function handlePreview() {
    setErroComp(null);
    setOkMsg(null);
    startTransition(async () => {
      const p = await previewCompensacao();
      if (!p) { setErroComp("Sem metas configuradas ou sem déficit a recuperar."); return; }
      if (p.diasPropostos.length === 0) { setErroComp("Sem dias restantes para compensar no mês."); return; }
      setProposta(p);
      setShowPreview(true);
    });
  }

  function handleAplicar() {
    if (!proposta) return;
    setErroComp(null);
    setOkMsg(null);
    startTransition(async () => {
      const res = await aplicarCompensacao();
      if (!res.ok) { setErroComp(res.erro); return; }
      setOkMsg(`Compensação aplicada: ${res.diasAplicados} dias atualizados. Cronograma regenerado.`);
      setShowPreview(false);
      setProposta(null);
      onAplicado();
    });
  }

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Compensacao do mes</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Redistribui o deficit acumulado pelos dias restantes do mes (respeitando um teto).
            Grava overrides automaticamente e regenera o cronograma.
          </p>
        </div>
      </div>

      {!showPreview && (
        <Button type="button" onClick={handlePreview} disabled={isPending}>
          {isPending ? "Calculando…" : "Ver proposta de compensacao"}
        </Button>
      )}

      {showPreview && proposta && (
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-300 dark:border-amber-900 bg-card p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">
              Proposta: {proposta.diasPropostos.length} dia(s) com meta aumentada
            </p>
            {!proposta.cobreTotal && (
              <p className="text-xs text-red-600 dark:text-red-400">
                Atencao: mesmo no teto, ficam {proposta.deficitResidual}min sem cobrir.
                A prioridade do cronograma decidira o que fica de fora.
              </p>
            )}
            <ul className="space-y-1 max-h-40 overflow-y-auto">
              {proposta.diasPropostos.map((d) => (
                <li key={d.data} className="flex justify-between text-sm text-foreground">
                  <span>{dataBr(d.data)}</span>
                  <span className="font-medium">{formatarMin(d.minutosMeta)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-3">
            <Button type="button" onClick={handleAplicar} disabled={isPending}>
              {isPending ? "Aplicando…" : "Aplicar compensacao"}
            </Button>
            <button
              type="button"
              onClick={() => { setShowPreview(false); setProposta(null); }}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {erroComp && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">{erroComp}</p>
      )}
      {okMsg && (
        <p className="text-sm text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-lg px-3 py-2">{okMsg}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seção: Regenerar cronograma
// ---------------------------------------------------------------------------

function BotaoRegenar() {
  const [msg, setMsg]            = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRegen() {
    setMsg(null);
    startTransition(async () => {
      const res = await regenerarCronograma();
      if (res.ok) {
        setMsg(`Cronograma regenerado: ${res.blocos.length} blocos na proxima semana.`);
      } else {
        setMsg(`Erro: ${res.erro}`);
      }
    });
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Button type="button" onClick={handleRegen} disabled={isPending}>
        {isPending ? "Regenerando…" : "Regenerar cronograma"}
      </Button>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seção: Saldo mensal (status textual)
// ---------------------------------------------------------------------------

interface SaldoMensalProps {
  saldoMensal: SaldoMes | null;
}

function SecaoSaldoMensal({ saldoMensal }: SaldoMensalProps) {
  if (!saldoMensal || !saldoMensal.metaMensalMin) {
    return null;
  }

  const pct = saldoMensal.pctMeta ?? Math.round((saldoMensal.realMin / (saldoMensal.metaMensalMin || 1)) * 100);
  const status = saldoMensal.saldoMes >= 0 ? "adiantada" : "atrasada";

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
      <h2 className="text-base font-semibold text-foreground">Progresso do mes</h2>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-3xl font-bold text-foreground">{pct}%</span>
        <span className={`text-sm font-medium ${STATUS_COR[status] ?? "text-muted-foreground"}`}>
          {STATUS_LABEL[status]}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {formatarMin(saldoMensal.realMin)} de {formatarMin(saldoMensal.metaMensalMin ?? 0)} — saldo:{" "}
        <span className={saldoMensal.saldoMes >= 0 ? "text-green-600 dark:text-green-400 font-medium" : "text-red-600 dark:text-red-400 font-medium"}>
          {saldoMensal.saldoMes >= 0 ? "+" : ""}{formatarMin(saldoMensal.saldoMes)}
        </span>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function MetasForm({ metas, overrides, saldosMes, saldoMensal, hoje }: MetasFormProps) {
  // Trigger de refresh local (sem router.refresh para não recarregar pesado)
  const [refreshKey, setRefreshKey] = useState(0);
  function handleAtualizado() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="space-y-6">
      {/* Progresso mensal */}
      <SecaoSaldoMensal saldoMensal={saldoMensal} />

      {/* Gráfico anel de progresso mensal */}
      {saldoMensal?.metaMensalMin && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-foreground mb-4">Anel de progresso</h2>
          <GraficoProgressoMensal saldoMes={saldoMensal} />
        </div>
      )}

      {/* Gráfico real×meta por dia */}
      {saldosMes.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold text-foreground mb-4">Real × Meta (ultimos dias)</h2>
          <GraficoSaldoDias dados={saldosMes} />
        </div>
      )}

      {/* Compensação */}
      <SecaoCompensacao key={`comp-${refreshKey}`} onAplicado={handleAtualizado} />

      {/* Config base */}
      <ConfigBase metas={metas} onSalvo={handleAtualizado} />

      {/* Overrides */}
      <SecaoOverrides
        key={`ov-${refreshKey}`}
        overridesIniciais={overrides}
        hoje={hoje}
        onAtualizado={handleAtualizado}
      />

      {/* Regenerar cronograma */}
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-2">
        <h2 className="text-base font-semibold text-foreground">Regenerar cronograma</h2>
        <p className="text-xs text-muted-foreground">
          Recalcula os blocos de estudo usando as metas e overrides atuais.
          Blocos ja concluidos sao preservados.
        </p>
        <BotaoRegenar />
      </div>

      {/* Link de volta */}
      <div className="pt-2">
        <Link href="/plano" className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Voltar ao Plano do Dia
        </Link>
      </div>
    </div>
  );
}
