// src/app/onboarding/page.tsx
"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

const ONBOARDING_KEY = "syncplans_onboarded_v1";

export default function OnboardingProfile() {
  const router = useRouter();

  useEffect(() => {
    try {
      const flag = window.localStorage.getItem(ONBOARDING_KEY);

      // Si ya marcamos onboarding completado, vamos directo al resumen
      if (flag) {
        router.replace("/summary");
        return;
      }

      // Si nunca ha pasado por onboarding, marcamos flag y lo llevamos
      // al nuevo flujo 1–4 (oscuro, ultra-premium)
      window.localStorage.setItem(ONBOARDING_KEY, "1");
      router.replace("/onboarding/1");
      return;
    } catch {
      // Si localStorage falla por cualquier motivo, al menos lo llevamos
      // al flujo 1–4 para que no se quede colgado
      router.replace("/onboarding/1");
    }
  }, [router]);

  // No mostramos UI aquí, solo actuamos como "router de entrada"
  return null;
}