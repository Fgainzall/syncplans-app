// src/app/conflicts/detected/DetectedClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import PremiumHeader from "@/components/PremiumHeader";
import LogoutButton from "@/components/LogoutButton";

import {
  CalendarEvent,
  GroupType,
  groupMeta,
  computeVisibleConflicts,
  attachEvents,
} from "@/lib/conflicts";

import { loadEventsFromDb } from "@/lib/conflictsDbBridge";
import { Resolution, getMyConflictResolutionsMap } from "@/lib/conflictResolutionsDb";

// ✅ PEGA AQUÍ TODO TU CÓDIGO COMPLETO DE detected (helpers + componente + styles)
// (el mismo que me enviaste)
// y deja:
export default function ConflictsDetectedPage() {
  // ...
}
