// middleware.ts (debe estar en la raíz del repo, no dentro de src/)
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function canonicalHost() {
  const env = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "").trim();
  if (!env) return null;
  try {
    return new URL(env).host; // => syncplansapp.com
  } catch {
    return null;
  }
}

function isPublicPath(pathname: string) {
  // ✅ Auth pages
  if (pathname.startsWith("/auth/")) return true;

  // ✅ Next internals
  if (pathname.startsWith("/_next/")) return true;

  // ✅ Static assets / public files (PWA needs these unauthenticated)
  if (pathname === "/manifest.webmanifest") return true;
  if (pathname.startsWith("/icons/")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname === "/robots.txt") return true;
  if (pathname === "/sitemap.xml") return true;

  // ✅ APIs must remain reachable (they handle auth internally if needed)
  if (pathname.startsWith("/api/")) return true;

  // ✅ Landing
  if (pathname === "/") return true;

  return false;
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get("host") ?? url.host;

  // ✅ 0) Canonical SIEMPRE (incluye /auth/* y /api/*)
  const canon = canonicalHost();
  if (canon && host !== canon) {
    const redirectUrl = url.clone();
    redirectUrl.host = canon;
    redirectUrl.protocol = "https:";
    return NextResponse.redirect(redirectUrl);
  }

  // ✅ 1) Público: pasa sin chequear sesión
  if (isPublicPath(url.pathname)) return NextResponse.next();

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const supabaseAnon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  if (!supabaseUrl || !supabaseAnon) return NextResponse.next();

  // ✅ 2) Crear response primero para permitir set-cookie si hay refresh
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

  const { data } = await supabase.auth.getUser();

  if (!data?.user) {
    const loginUrl = new URL("/auth/login", url.origin);
    loginUrl.searchParams.set("next", url.pathname + url.search);

    const redirectResponse = NextResponse.redirect(loginUrl);
    // Mantener cualquier cookie que se haya seteado (por ejemplo, refresh de sesión fallido)
    response.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c));
    return redirectResponse;
  }

  return response;
}

export const config = {
  // Deja pasar todo por el middleware excepto assets internos de Next.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};