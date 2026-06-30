// [RSC] "Como usar" — guia completo do Advoga (Fase 2 / onboarding, proposal §3.2a).
// Conteúdo PT-BR, acolhedor e escaneável para a Kamile (recém-formada estudando
// para a OAB sob pressão de tempo). Explica o LOOP central e cada ambiente, com
// o porquê e o como usar. Tokens semânticos → correto em claro e escuro.
// O botão "Rever tour" (ilha cliente) re-dispara o first-run tour na mesma página.
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Dumbbell,
  Library,
  Lightbulb,
  LineChart,
  NotebookPen,
  RefreshCw,
  RotateCw,
  Target,
} from "lucide-react";
import { AppShell } from "@/components/shared/app-shell";
import { ReverTourButton } from "@/components/onboarding/rever-tour-button";

export const metadata = {
  title: "Como usar — Advoga",
};

type Icon = React.ComponentType<{ className?: string }>;

// Passo do loop central (a "engrenagem" do app).
function LoopStep({
  n,
  icon: Icon,
  titulo,
  texto,
}: {
  n: number;
  icon: Icon;
  titulo: string;
  texto: string;
}) {
  return (
    <li className="relative flex gap-3 rounded-xl border border-border bg-card p-4">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground">
          <span className="text-primary">{n}.</span> {titulo}
        </p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
          {texto}
        </p>
      </div>
    </li>
  );
}

// Card de uma ferramenta/ambiente: o quê, por que e como usar.
function Feature({
  icon: Icon,
  nome,
  onde,
  oque,
  porque,
  comousar,
}: {
  icon: Icon;
  nome: string;
  onde: string;
  oque: React.ReactNode;
  porque: React.ReactNode;
  comousar: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div>
          <h3 className="text-base font-bold text-foreground">{nome}</h3>
          <p className="text-xs text-muted-foreground">{onde}</p>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-foreground">{oque}</p>
      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="inline font-semibold text-foreground">Por que: </dt>
          <dd className="inline text-muted-foreground">{porque}</dd>
        </div>
        <div>
          <dt className="inline font-semibold text-foreground">Como usar: </dt>
          <dd className="inline text-muted-foreground">{comousar}</dd>
        </div>
      </dl>
    </section>
  );
}

export default function ComoUsarPage() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl p-6 md:p-8">
        {/* Hero */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Como usar o Advoga
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Oi, Kamile! Aqui está, sem juridiquês, como o app funciona e como
            tirar o máximo dele na reta da OAB. Comece pelo{" "}
            <strong className="font-semibold text-foreground">loop central</strong>{" "}
            abaixo — é o coração de tudo.
          </p>
          <div className="mt-4">
            <ReverTourButton />
          </div>
        </header>

        {/* ===================== O LOOP CENTRAL ===================== */}
        <section className="mb-10">
          <div className="mb-3 flex items-center gap-2">
            <RefreshCw className="size-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">O loop central</h2>
          </div>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            Todo o Advoga gira em torno de um ciclo simples. Você repete ele,
            subtema por subtema, e o app vai ajustando a rota pra você gastar
            energia onde rende mais. É só isso:
          </p>
          <ol className="grid gap-3 sm:grid-cols-2">
            <LoopStep
              n={1}
              icon={BookOpen}
              titulo="Estude o subtema"
              texto="Abra o bloco de conteúdo do dia no Cronograma e estude aquele subtema específico."
            />
            <LoopStep
              n={2}
              icon={Dumbbell}
              titulo="Treine as questões dele"
              texto="No mesmo bloco, treine as questões daquele subtema — só as daquele assunto, recém-estudado."
            />
            <LoopStep
              n={3}
              icon={Activity}
              titulo="Veja seu desempenho"
              texto="Em Progresso e no Dashboard você vê onde acertou, onde travou e quanto tempo gastou."
            />
            <LoopStep
              n={4}
              icon={RotateCw}
              titulo="O sistema reprioriza"
              texto="Com seus resultados + o que mais cai na FGV, o Cronograma reordena o que vem a seguir. Volta ao passo 1."
            />
          </ol>
          <p className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed text-foreground">
            <strong className="font-semibold">A grande sacada:</strong> conteúdo{" "}
            <em>antes</em> das questões, e questões sempre do subtema que você
            acabou de estudar. Assim você fixa de verdade — em vez de chutar e
            esquecer.
          </p>
        </section>

        {/* ===================== AMBIENTE: ESTUDO ===================== */}
        <h2 className="mb-3 text-xl font-bold text-foreground">
          No dia a dia: Estudo
        </h2>
        <div className="mb-10 space-y-4">
          <Feature
            icon={CalendarDays}
            nome="Cronograma"
            onde="Estudo › Cronograma"
            oque={
              <>
                Seu roteiro de estudo em <strong>blocos por subtema</strong>,
                gerados automaticamente e já na ordem certa. Cada subtema vem com
                um bloco de <strong>conteúdo</strong> e um de{" "}
                <strong>questões</strong>.
              </>
            }
            porque={
              <>
                Os blocos são priorizados pela <strong>incidência real da FGV</strong>{" "}
                (o que mais cai) e pela sua fraqueza diagnosticada — você não
                perde tempo decidindo por onde começar.
              </>
            }
            comousar={
              <>
                Defina suas horas por dia, gere o roteiro e siga de cima pra
                baixo: estude o conteúdo, depois as questões. Marque cada bloco
                como <strong>feito</strong> ao concluir — é assim que o app sabe
                seu avanço.
              </>
            }
          />
          <Feature
            icon={Dumbbell}
            nome="Treino"
            onde="Estudo › Treino (botão “Treinar questões”)"
            oque={
              <>
                Questões focadas em <strong>um subtema</strong>. Durante o treino
                você responde <strong>sem ver o gabarito</strong> — igual à
                prova.
              </>
            }
            porque={
              <>
                Ver a resposta na hora vicia: você reconhece em vez de raciocinar.
                Escondendo o gabarito até o fim, o treino mede o que você{" "}
                <strong>realmente</strong> sabe.
              </>
            }
            comousar={
              <>
                Entre por <strong>“Treinar questões”</strong> de um subtema (pelo
                bloco do Cronograma ou pela tabela de Incidência), responda tudo,
                clique em <strong>Finalizar</strong> — e <em>só então</em> aparece
                o resultado e o gabarito de cada questão.
              </>
            }
          />
          <Feature
            icon={LineChart}
            nome="Progresso e diagnóstico"
            onde="Estudo › Progresso"
            oque={
              <>
                Seu raio-x de estudo: <strong>tempo por matéria</strong>,{" "}
                <strong>esforço × resultado</strong> (onde você investe tempo e o
                que isso rende) e <strong>desempenho por característica</strong>{" "}
                das questões.
              </>
            }
            porque={
              <>
                Mostra se o esforço está virando acerto — e revela pontos cegos
                (matéria que consome horas e não rende, ou estilo de questão que
                te pega).
              </>
            }
            comousar={
              <>
                Os painéis <strong>acendem conforme você usa</strong> o app:
                quanto mais blocos e treinos, mais preciso o diagnóstico. Vereditos
                só aparecem com volume suficiente — abaixo disso, fica “medindo”
                (sem chute).
              </>
            }
          />
        </div>

        {/* ===================== AMBIENTE: VERIFICAÇÃO ===================== */}
        <h2 className="mb-3 text-xl font-bold text-foreground">
          Para enxergar o todo: Verificação
        </h2>
        <div className="mb-10 space-y-4">
          <Feature
            icon={BarChart3}
            nome="Incidência e tendência"
            onde="Verificação › Incidência"
            oque={
              <>
                O ranking do que a prova <strong>mais cobra por subtema</strong>,
                ao longo das edições — com um mini-gráfico de cada subtema por
                edição.
              </>
            }
            porque={
              <>
                Te diz onde concentrar energia: priorize{" "}
                <strong>volume histórico</strong>, o que cai com frequência.
              </>
            }
            comousar={
              <>
                Leia o ranking de cima pra baixo e use “Treinar” direto na tabela.
                Importante: o painel é <strong>descritivo, não preditivo</strong>{" "}
                — mostra o que <em>já caiu</em>, não adivinha o que <em>vai cair</em>.
                Não existe subtema “na vez”.
              </>
            }
          />
          <Feature
            icon={Activity}
            nome="Dashboard"
            onde="Verificação › Dashboard"
            oque={
              <>
                Visão geral: contagem regressiva para a prova, questões feitas,
                taxa de acerto, evolução no tempo e acerto por matéria.
              </>
            }
            porque={
              <>
                É o seu termômetro. Em poucos segundos você sabe se está
                melhorando, estável ou caindo — e qual matéria puxa pra baixo.
              </>
            }
            comousar={
              <>
                Dê uma olhada no começo ou no fim da semana para calibrar o foco.
                Clique numa matéria fraca e leve essa info pro seu Cronograma.
              </>
            }
          />
        </div>

        {/* ===================== RÁPIDO: METAS, REGISTRO, MATERIAIS ===================== */}
        <h2 className="mb-3 text-xl font-bold text-foreground">Rápido</h2>
        <div className="mb-10 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <Target className="size-5 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Metas</h3>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Defina sua <strong>meta de horas</strong> por dia e por mês. O app
              calcula seu <strong>saldo</strong> (adiantada ou devendo) e a{" "}
              <strong>compensação</strong> para redistribuir o déficit sem
              culpa.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <NotebookPen className="size-5 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Registro</h3>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Anote o que estudou, por quanto tempo e onde. É o que alimenta o{" "}
              <strong>tempo por matéria</strong> e o cruzamento esforço ×
              resultado no Progresso.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2">
              <Library className="size-5 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Materiais</h3>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Seu catálogo de livros, PDFs e vídeos. Associe um material ao
              registrar estudo para saber depois{" "}
              <strong>o que rendeu mais</strong>.
            </p>
          </div>
        </div>

        {/* ===================== DICAS DE USO ===================== */}
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="size-5" />
            <h2 className="text-lg font-bold">Dicas de uso</h2>
          </div>
          <ul className="space-y-2.5 text-sm leading-relaxed">
            <li className="flex gap-2">
              <ArrowRight className="mt-0.5 size-4 shrink-0" />
              <span>
                <strong>Use o Cronograma como guia do dia.</strong> Abra ele toda
                manhã, faça o bloco do topo e marque como feito. Não precisa
                decidir nada — ele já decidiu por você.
              </span>
            </li>
            <li className="flex gap-2">
              <ArrowRight className="mt-0.5 size-4 shrink-0" />
              <span>
                <strong>Conteúdo antes de questões, sempre.</strong> Estude o
                subtema e treine na sequência, enquanto está fresco. É o loop
                central funcionando.
              </span>
            </li>
            <li className="flex gap-2">
              <ArrowRight className="mt-0.5 size-4 shrink-0" />
              <span>
                <strong>Constância vence intensidade.</strong> Um pouco todo dia
                mantém o saldo de Metas em dia e o diagnóstico afiado — melhor que
                maratonas isoladas.
              </span>
            </li>
            <li className="flex gap-2">
              <ArrowRight className="mt-0.5 size-4 shrink-0" />
              <span>
                <strong>No treino, resista a “espiar”.</strong> Responda tudo e só
                finalize quando terminar. O resultado honesto é o que faz o
                diagnóstico valer.
              </span>
            </li>
            <li className="flex gap-2">
              <ArrowRight className="mt-0.5 size-4 shrink-0" />
              <span>
                <strong>Estudou à noite?</strong> Use o tema escuro (botão de
                sol/lua no topo) para cansar menos a vista.
              </span>
            </li>
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
