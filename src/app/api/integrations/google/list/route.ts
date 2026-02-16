import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const supabaseAnon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        cookieStore.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "No autenticado" },
      { status: 401 }
    );
  }

  const { data: ga, error: gaErr } = await supabase
    .from("google_accounts")
    .select("access_token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (gaErr || !ga?.access_token) {
    return NextResponse.json(
      { ok: false, error: "No hay Google conectado (token no encontrado)." },
      { status: 400 }
    );
  }

  const timeMin = new Date().toISOString();

  const r = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
      timeMin
    )}&singleEvents=true&orderBy=startTime&maxResults=50`,
    {
      headers: {
        Authorization: `Bearer ${ga.access_token}`,
      },
    }
  );

  const json = await r.json();

  if (!r.ok) {
    return NextResponse.json(
      { ok: false, status: r.status, google: json },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, items: json.items ?? [] });
}