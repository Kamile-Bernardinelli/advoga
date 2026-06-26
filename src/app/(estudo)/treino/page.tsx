// [RSC] Sessão de treino gerada pelo planner (vira sessão tipo 'treino')
// Recebe origem do plano via searchParams ou params
export default async function TreinoPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Treino Focado</h1>
      <p className="text-gray-500 mb-6">
        Sessão de treino gerada pelo planner com questões dos nós-alvo.
      </p>
      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-400">
        Runner de treino — a implementar (Drop 1)
      </div>
    </div>
  );
}
