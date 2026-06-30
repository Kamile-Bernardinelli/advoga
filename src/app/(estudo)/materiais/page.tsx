// [RSC] Catálogo de Materiais — Cockpit Fatia B
// CRUD de materiais de estudo. Usado como referência em estudo_sessoes (material_id).

import { listarMateriais } from "@/app/(estudo)/_actions/materiais.actions";
import { MateriaisForm } from "./materiais-form";

export default async function MateriaisPage() {
  const materiais = await listarMateriais();

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Materiais de Estudo</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Catálogo de livros, PDFs, vídeos e outros materiais usados nas sessões.
          O material é associado ao registrar estudo (campo opcional).
        </p>
      </div>

      <MateriaisForm inicial={materiais} />
    </div>
  );
}
