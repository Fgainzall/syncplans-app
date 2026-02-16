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

  // ✅ IMPORTANTÍSIMO:
  // Para que Google OAuth no se rompa, NO hagas canonical redirect dentro de /auth/*
  // (porque puede venir de www/preview y necesita ejecutar el callback sin tocar el host)
  if (!url.pathname.startsWith("/auth/")) {
    const canon = canonicalHost();
    if (canon && host !== canon) {
      url.host = canon;
      url.protocol = "https:";
      return NextResponse.redirect(url);
    }
  }

  // ✅ 2) Auth protection
  if (isPublicPath(url.pathname)) return NextResponse.next();

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const supabaseAnon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (!supabaseUrl || !supabaseAnon) return NextResponse.next();

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

  // 🔥 En middleware es mejor getUser() (no getSession) para evitar casos raros de refresh
  const { data } = await supabase.auth.getUser();

  if (!data?.user) {
    const login = new URL("/auth/login", url.origin);
    login.searchParams.set("next", url.pathname + url.search);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};