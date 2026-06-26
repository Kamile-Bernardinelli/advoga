"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/db.types";

// Cliente para componentes client (browser) — anon key, RLS aplica.
// Usar APENAS para interatividade reativa (Consulta/busca, toggles do dashboard).
// NUNCA para correção, finalização ou leitura de gabarito.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
