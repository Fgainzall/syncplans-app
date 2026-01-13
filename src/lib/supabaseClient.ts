import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

// ✅ NO reventar en build: usar placeholders si faltan.
// En runtime, si faltan, las llamadas fallarán y lo verás claramente en consola.
const safeUrl = supabaseUrl || "https://example.supabase.co";
const safeAnon = supabaseAnonKey || "public-anon-key-missing";

const supabase = createClient(safeUrl, safeAnon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export default supabase;
