// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

type SupabaseCookieOptions = {
  domain?: string;
  path?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  sameSite?: boolean | "lax" | "strict" | "none";
  secure?: boolean;
};

function canonicalHost() {
  const env = (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    ""
  ).trim();

  if (!env) return null;

  try {
    return new URL(env).host;
  } catch {
    return null;
  }
}

function isKnownApiPath(pathname: string) {
  // Public / healthcheck.
  if (pathname === "/api/ping") return true;

  // Cron/internal endpoints. These must reach their handlers because they use
  // Authorization: Bearer CRON_SECRET or their own per-route secret checks.
  if (pathname.startsWith("/api/cron/")) return true;
  if (pathname === "/api/daily-digest") return true;
  if (pathname === "/api/push/test") return true;

  // External callbacks / public invite resolution. These cannot require a
  // normal app session at middleware level.
  if (pathname === "/api/google/callback") return true;
  if (pathname.startsWith("/api/public-invite/")) return true;

  // Authenticated user APIs. They still validate the Supabase user inside each
  // route handler, which keeps API responses as JSON instead of middleware HTML redirects.
  if (pathname === "/api/email/invite") return true;
  if (pathname === "/api/google/connect") return true;
  if (pathname === "/api/google/status") return true;
  if (pathname === "/api/google/sync") return true;
  if (pathname === "/api/integrations/google/list") return true;
  if (pathname === "/api/maps/autocomplete") return true;
  if (pathname === "/api/maps/route-eta") return true;
  if (pathname === "/api/push/subscribe") return true;
  if (pathname === "/api/user/location") return true;

  return false;
}

function isPublicPath(pathname: string) {
  // Landing publica.
  if (pathname === "/") return true;
  if (pathname === "/home") return true;

  // Invite publico.
  if (pathname.startsWith("/invite/")) return true;

  // Auth pages.
  if (pathname.startsWith("/auth/")) return true;

  // Next internals.
  if (pathname.startsWith("/_next/")) return true;

  // Static assets / public files. Estos no deben pasar por auth porque en PWA/iOS
  // forman parte del arranque visual antes de que React pinte.
  if (pathname === "/manifest.webmanifest") return true;
  if (pathname === "/sw.js") return true;
  if (pathname.startsWith("/icons/")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (pathname.endsWith(".svg")) return true;
  if (pathname.endsWith(".png")) return true;
  if (pathname === "/robots.txt") return true;
  if (pathname === "/sitemap.xml") return true;

  // APIs: explicit allowlist only. Do not replace this with pathname.startsWith("/api/").
  if (pathname.startsWith("/api/")) return isKnownApiPath(pathname);

  return false;
}

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  const host = request.headers.get("host") ?? url.host;

  // Canonical host.
  const canon = canonicalHost();
  if (canon && host !== canon) {
    const redirectUrl = url.clone();
    redirectUrl.host = canon;
    redirectUrl.protocol = "https:";
    return NextResponse.redirect(redirectUrl);
  }

  // Public and explicitly classified routes pass through.
  if (isPublicPath(url.pathname)) {
    return NextResponse.next();
  }

  // Unknown API routes are blocked by default. Any new API must be classified
  // explicitly in isKnownApiPath before it can be reached.
  if (url.pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        ok: false,
        error: "API no clasificada en middleware.",
        code: "API_ROUTE_NOT_ALLOWLISTED",
      },
      {
        status: 403,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const supabaseAnon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

  if (!supabaseUrl || !supabaseAnon) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: SupabaseCookieOptions) {
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: SupabaseCookieOptions) {
        response.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  // Performance de arranque: para páginas protegidas usamos la sesión local del
  // cookie y dejamos que Supabase/RLS valide los datos reales en cada query.
  // Evitamos auth.getUser() aquí porque hace una validación remota y puede dejar
  // la PWA esperando HTML con pantalla blanca, especialmente en iPhone.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    if (url.pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          ok: false,
          error: "No autenticado.",
          code: "API_UNAUTHORIZED",
        },
        {
          status: 401,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const loginUrl = new URL("/auth/login", url.origin);
    loginUrl.searchParams.set("next", url.pathname + url.search);

    const redirectResponse = NextResponse.redirect(loginUrl);

    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });

    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
