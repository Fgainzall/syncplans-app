// src/lib/supabaseClient.ts
"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cachedSupabase: SupabaseClient | null = null;

function readSupabaseBrowserEnv() {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const supabaseAnonKey = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  ).trim();

  return { supabaseUrl, supabaseAnonKey };
}

function missingSupabaseBrowserEnvError(): Error {
  return new Error(
    [
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      "Revisa .env.local o las variables de Vercel.",
      "El cliente Supabase se inicializa de forma diferida para no romper el build por import temprano.",
    ].join(" ")
  );
}

export function getSupabaseClient(): SupabaseClient {
  if (cachedSupabase) return cachedSupabase;

  const { supabaseUrl, supabaseAnonKey } = readSupabaseBrowserEnv();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw missingSupabaseBrowserEnvError();
  }

  cachedSupabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return cachedSupabase;
}

const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseClient();
    const value = Reflect.get(client, prop, receiver);

    if (typeof value === "function") {
      return value.bind(client);
    }

    return value;
  },
});

export default supabase;
