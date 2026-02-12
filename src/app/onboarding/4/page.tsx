import { Suspense } from "react";
import Onboarding4Client from "./Onboarding4Client";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Onboarding4Client />
    </Suspense>
  );
}