// @ts-nocheck
// src/app/calendar/day/page.tsx

import { Suspense } from "react";
import CalendarDayClient from "./CalendarDayClient";

export default function CalendarDayPage() {
  return (
    <Suspense fallback={null}>
      <CalendarDayClient />
    </Suspense>
  );
}
