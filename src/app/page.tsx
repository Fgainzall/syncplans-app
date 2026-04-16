// src/app/page.tsx
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default async function HomePage() {
  try {
    const supabase = await supabaseServer();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session) {
      redirect("/summary");
    }
  } catch {
    // Si falla el chequeo server de sesión, igual mandamos a login.
  }

  redirect("/auth/login?next=%2Fsummary");
}