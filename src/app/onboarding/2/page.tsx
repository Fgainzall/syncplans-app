import { Suspense } from "react";
import Onboarding2Client from "./Onboarding2Client";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Onboarding2Client />
    </Suspense>
  );
}