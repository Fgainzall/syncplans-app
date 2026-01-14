import { createClient } from "@supabase/supabase-js";

function mustGetPublicEnv(name: string): string {
  const v = (process.env[name] ?? "").toString().trim();
  return v;
}

const supabaseUrl = mustGetPublicEnv("NEXT_PUBLIC_SUPABASE_URL");
const supabaseAnonKey = mustGetPublicEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

// Detectar si estamos en producción en Next/Vercel
const isProd = process.env.NODE_ENV === "production";

// ⚠️ En prod: NUNCA permitir placeholder.
// Si falta una env var, es mejor fallar rápido con mensaje claro.
if (isProd) {
  if (!supabaseUrl || supabaseUrl.includes("placeholder.supabase.co")) {
    throw new Error(
      "Missing/invalid NEXT_PUBLIC_SUPABASE_URL in production. Check Vercel Environment Variables (Production) and redeploy."
    );
  }
  if (!supabaseAnonKey || supabaseAnonKey.includes("placeholder")) {
    throw new Error(
      "Missing/invalid NEXT_PUBLIC_SUPABASE_ANON_KEY in production. Check Vercel Environment Variables (Production) and redeploy."
    );
  }
}

// En dev/local: si falta, dejamos placeholders para no crashear el build,
// pero te va a quedar claro en consola.
const safeUrl = supabaseUrl || "https://placeholder.supabase.co";
const safeKey = supabaseAnonKey || "public-anon-key-placeholder";

if (!isProd && safeUrl.includes("placeholder.supabase.co")) {
  // eslint-disable-next-line no-console
  console.warn(
    "[supabaseClient] Using placeholder Supabase URL/key. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
  );
}

const supabase = createClient(safeUrl, safeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export default supabase;
