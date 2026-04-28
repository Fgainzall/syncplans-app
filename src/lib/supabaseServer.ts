// src/lib/supabaseServer.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
type SupabaseCookieOptions = {
  domain?: string;
  path?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  sameSite?: boolean | "lax" | "strict" | "none";
  secure?: boolean;
};

type ServerCookieStore = Awaited<ReturnType<typeof cookies>>;
export async function supabaseServer() {
const cookieStore: ServerCookieStore = await cookies();

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
     set(name: string, value: string, options: SupabaseCookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // En Server Components, cookies() puede ser read-only. No romper.
        }
      },
     remove(name: string, options: SupabaseCookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options, maxAge: 0 });
        } catch {
          // no-op
        }
      },
    },
  });
}