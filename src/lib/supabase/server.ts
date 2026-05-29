import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdminClient() {
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL.");
  }

  if (!supabaseServiceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
  }

  if (supabaseUrl.includes("your-project.supabase.co")) {
    throw new Error("Configura SUPABASE_URL con tu proyecto real de Supabase.");
  }

  if (supabaseServiceRoleKey.includes("your-service-role-key")) {
    throw new Error(
      "Configura SUPABASE_SERVICE_ROLE_KEY con tu service role real.",
    );
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
