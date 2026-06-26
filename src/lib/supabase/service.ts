import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/db.types";

// Cliente service_role — SOMENTE server-side (Server Actions/ingestão).
// NUNCA usar em componentes client ou expor via NEXT_PUBLIC_*.
// Usado EXCLUSIVAMENTE em: finalizeSession (correção) + pipeline de ingestão.
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "[service.ts] NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente. " +
        "Verifique .env.local e garanta que SUPABASE_SERVICE_ROLE_KEY NUNCA usa prefixo NEXT_PUBLIC_."
    );
  }

  return createClient<Database>(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
