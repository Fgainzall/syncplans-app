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

  // 1️⃣ Canonical redirect
  const canon = canonicalHost();
  if (canon && host !== canon) {
    url.host = canon;
    url.protocol = "https:";
    return NextResponse.redirect(url);
  }

  if (isPublicPath(url.pathname)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => request.cookies.get(name)?.value,
        set: (name, value, options) => {
          response.cookies.set({ name, value, ...options });
        },
        remove: (name, options) => {
          response.cookies.set({ name, value: "", ...options, maxAge: 0 });
        },
      },
    }
  );

  // 🔥 CAMBIO CLAVE
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const login = new URL("/auth/login", url.origin);
    login.searchParams.set("next", url.pathname + url.search);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};