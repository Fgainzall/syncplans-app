// src/app/register/page.tsx
import RegisterRedirectClient from "./RegisterRedirectClient";

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
  if (!raw) return "/calendar";
  return raw.startsWith("/") ? raw : "/calendar";
}

export default function Page({ searchParams }: PageProps) {
  const next = safeNext(asString(searchParams?.next));
  return <RegisterRedirectClient next={next} />;
}
