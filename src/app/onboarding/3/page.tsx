import { Suspense } from "react";
import Onboarding3Client from "./Onboarding3Client";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Onboarding3Client />
    </Suspense>
  );
}