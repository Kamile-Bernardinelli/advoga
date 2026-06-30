// [client] Busca/filtro no banco de questões (com gabarito — modo estudo, NÃO prova)
export default function QuestoesConsultaPage() {
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Banco de Questões</h1>
      <p className="text-muted-foreground mb-6">
        Pesquise questões por matéria, subtema ou palavra-chave. O gabarito é
        visível aqui (modo estudo, não prova).
      </p>
      {/* TODO: filtros + lista de questões com react-query */}
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
        Busca de questões — a implementar (Drop 1)
      </div>
    </div>
  );
}
