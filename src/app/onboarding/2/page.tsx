import { Suspense } from "react";
import type { ReactNode } from "react";
import Onboarding2Client from "./Onboarding2Client";

function OnboardingStepFallback(): ReactNode {
  return (
    <main className="min-h-dvh bg-[#071126] text-white">
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] items-center px-6 py-10">
        <div className="w-full rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-cyan-400/20 ring-1 ring-cyan-300/30" />
            <div className="space-y-2">
              <div className="h-3 w-24 rounded-full bg-white/10" />
              <div className="h-4 w-32 rounded-full bg-white/15" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="h-5 w-28 rounded-full bg-cyan-400/15" />
            <div className="h-8 w-4/5 rounded-full bg-white/15" />
            <div className="h-4 w-full rounded-full bg-white/10" />
            <div className="h-4 w-11/12 rounded-full bg-white/10" />
          </div>

          <div className="mt-8 grid gap-3">
            <div className="h-16 rounded-2xl bg-white/8" />
            <div className="h-16 rounded-2xl bg-white/8" />
            <div className="h-16 rounded-2xl bg-white/8" />
          </div>

          <div className="mt-8 h-12 rounded-2xl bg-white/12" />
        </div>
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<OnboardingStepFallback />}>
      <Onboarding2Client />
    </Suspense>
  );
}