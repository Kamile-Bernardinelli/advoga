import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/db.types";

// Cliente para RSC (Server Components) — cookies read-only, anon key, RLS aplica.
// NUNCA seleciona questoes.gabarito em fluxo de prova ativa — usa view questoes_prova.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: CookieOptions }>) {
          // RSC: cookies são read-only neste contexto; ignorado com segurança
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Esperado em RSC — o middleware gerencia o refresh
          }
        },
      },
    }
  );
}
