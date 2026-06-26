import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Proxy (Next.js 16 — anteriormente "middleware"):
// Mantém a sessão do Supabase viva (refresh de token).
// Single-user — Kamile — mas o padrão oficial @supabase/ssr se aplica.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Protege todas as rotas exceto arquivos estáticos e healthcheck
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
