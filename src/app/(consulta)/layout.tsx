// AMBIENTE: CONSULTA — legislação + banco pesquisável (mobile-friendly)
export default function ConsultaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white px-6 py-3">
        <span className="font-semibold text-gray-900">
          Ambiente de Consulta
        </span>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
