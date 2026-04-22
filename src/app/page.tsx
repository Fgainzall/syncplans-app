// src/app/page.tsx
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { getMyOnboardingState } from "@/lib/profilesDb";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const LOGIN_PATH = "/auth/login?next=%2F";
const ONBOARDING_PATH = "/onboarding";
const AUTHENTICATED_HOME_PATH = "/summary";

export default async function HomePage() {
  try {
    const supabase = await supabaseServer();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      redirect(LOGIN_PATH);
    }

    const onboardingState = await getMyOnboardingState();

    if (!onboardingState.completed) {
      redirect(ONBOARDING_PATH);
    }

    redirect(AUTHENTICATED_HOME_PATH);
  } catch {
    // Si falla el chequeo server-side de sesión o del perfil,
    // mandamos al login como fallback seguro.
    redirect(LOGIN_PATH);
  }
}