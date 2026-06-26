import type { SupabaseClient } from "@supabase/supabase-js";
import { hojeLocal } from "@/lib/metas/saldo";

/** Timezone IANA da usuária (metas_estudo.timezone) — default America/Sao_Paulo. */
export async function carregarTimezone(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  userId: string
): Promise<string> {
  const { data } = await client
    .from("metas_estudo")
    .select("timezone")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as { timezone: string } | null)?.timezone ?? "America/Sao_Paulo";
}

/** "Hoje" (YYYY-MM-DD) no fuso da usuária — evita o drift UTC → dia errado à noite. */
export async function hojeDoUsuario(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: SupabaseClient<any>,
  userId: string
): Promise<string> {
  return hojeLocal(await carregarTimezone(client, userId));
}
