// src/app/login/page.tsx
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type PageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function asString(v: string | string[] | undefined): string | null {
  if (!v) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

function safeNext(raw: string | null): string {
  if (!raw) return "/summary";
  return raw.startsWith("/") ? raw : "/summary";
}

export default async function Page({ searchParams }: PageProps) {
  const next = safeNext(asString(searchParams?.next));

  try {
    const supabase = await supabaseServer();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      redirect(next);
    }
  } catch {
    // Si falla la lectura server-side de sesión, seguimos al login real sin romper el flujo.
  }

  redirect(`/auth/login?next=${encodeURIComponent(next)}`);
}