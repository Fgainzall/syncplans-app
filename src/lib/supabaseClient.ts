import { createClient } from "@supabase/supabase-js";

// ✅ IMPORTANT: NO usar process.env[name] dinámico en Next.js
// porque no inyecta NEXT_PUBLIC_* en el bundle del browser.

const supabaseUrl =
  (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim() ||
  (process.env.SUPABASE_URL ?? "").trim();

const supabaseAnonKey =
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim() ||
  (process.env.SUPABASE_ANON_KEY ?? "").trim();

// ✅ En producción, si falta algo, lo vemos claro
if (process.env.NODE_ENV === "production") {
  if (!supabaseUrl || !supabaseUrl.startsWith("https://")) {
    throw new Error(
      "Missing/invalid NEXT_PUBLIC_SUPABASE_URL in production. Check Vercel Environment Variables (Production) and redeploy."
    );
  }
  if (!supabaseAnonKey || supabaseAnonKey.length < 20) {
    throw new Error(
      "Missing/invalid NEXT_PUBLIC_SUPABASE_ANON_KEY in production. Check Vercel Environment Variables (Production) and redeploy."
    );
  }
}

// ✅ Cliente único
const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "public-anon-key-placeholder",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export default supabase;
