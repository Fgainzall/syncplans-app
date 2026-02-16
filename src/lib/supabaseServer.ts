// src/lib/supabaseServer.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function supabaseServer() {
  const cookieStore: any = await Promise.resolve(cookies());

  const url =
    (process.env.NEXT_PUBLIC_SUPABASE_URL ??
      process.env.SUPABASE_URL ??
      "").trim();

  const anon =
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      process.env.SUPABASE_ANON_KEY ??
      "").trim();

  if (!url || !anon) {
    throw new Error("Missing Supabase env vars for server client.");
  }

  return createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // En Server Components, cookies() puede ser read-only. No romper.
        }
      },
      remove(name: string, options: any) {
        try {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 });
        } catch {
          // no-op
        }
      },
    },
  });
}