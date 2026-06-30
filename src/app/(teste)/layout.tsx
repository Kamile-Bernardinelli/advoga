// AMBIENTE: TESTE — layout "foco" sem distração
// O ProvaRunner tem seu próprio header sticky (timer + finalizar).
// Este layout é usado nas páginas de listagem; a prova ativa renderiza sem header duplicado.
export default function TesteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {children}
    </div>
  );
}
