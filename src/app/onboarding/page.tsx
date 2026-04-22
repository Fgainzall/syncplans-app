// src/app/onboarding/page.tsx
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabaseServer";
import { getMyOnboardingState } from "@/lib/profilesDb";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const LOGIN_PATH = "/auth/login?next=%2Fonboarding";
const ONBOARDING_START_PATH = "/onboarding/1";
const AUTHENTICATED_HOME_PATH = "/summary";

export default async function OnboardingPage() {
  try {
    const supabase = await supabaseServer();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      redirect(LOGIN_PATH);
    }

    const onboardingState = await getMyOnboardingState();

    if (onboardingState.completed) {
      redirect(AUTHENTICATED_HOME_PATH);
    }

    redirect(ONBOARDING_START_PATH);
  } catch {
    redirect(LOGIN_PATH);
  }
}