import { Suspense } from "react";
import Onboarding1Client from "./Onboarding1Client";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Onboarding1Client />
    </Suspense>
  );
}