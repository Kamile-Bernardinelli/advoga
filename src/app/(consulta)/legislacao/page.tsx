// [RSC/client] Busca em leis
// Drop 1: stub com links para Planalto — Drop 3 implementa busca full-text
export default async function LegislacaoPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Legislação</h1>
      <p className="text-gray-500 mb-6">
        Consulta rápida de legislação. Drop 1: links externos ao Planalto.
        Drop 3: busca full-text integrada.
      </p>
      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-gray-400">
        Busca de legislação — stub (Drop 1)
      </div>
    </div>
  );
}
