"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabaseClient";

export default function HomeSessionRedirect() {
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (active && session) {
         router.replace("/onboarding");
        }
      } catch {
        // noop
      }
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) {
        router.replace("/summary");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  return null;
}