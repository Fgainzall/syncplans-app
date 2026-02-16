// src/middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function canonicalHost() {
  const env = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "").trim();
  if (!env) return null;
  try {
    return new URL(env).host;
  } catch {
    return null;
  }
}

function isPublicPath(pathname: string) {
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.startsWith("/api/")) return true;
  if (pathname === "/") return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get("host") ?? url.host;

  // ✅ 0) Canonical (pero nunca dentro de /auth/*)
  if (!url.pathname.startsWith("/auth/")) {
    const canon = canonicalHost();
    if (canon && host !== canon) {
      const redirectUrl = url.clone();
      redirectUrl.host = canon;
      redirectUrl.protocol = "https:";
      return NextResponse.redirect(redirectUrl);
    }
  }

  // ✅ 1) Dejar pasar público
  if (isPublicPath(url.pathname)) return NextResponse.next();

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const supabaseAnon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (!supabaseUrl || !supabaseAnon) return NextResponse.next();

  // ✅ 2) Importante: crear response primero, porque Supabase puede necesitar setear cookies (refresh)
  const response = NextResponse.next();

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        response.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  // ✅ getUser() (bien)
  const { data } = await supabase.auth.getUser();

  if (!data?.user) {
    const loginUrl = new URL("/auth/login", url.origin);
    loginUrl.searchParams.set("next", url.pathname + url.search);

    // ✅ Si supabase intentó setear cookies (refresh), no las pierdas al redirigir.
    const redirectResponse = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c));
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};