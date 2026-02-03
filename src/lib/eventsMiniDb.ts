// src/lib/eventsMiniDb.ts
"use client";

/**
 * LEGACY MINI-DB ADAPTER
 * ----------------------
 * Este módulo existe SOLO para mantener compatibilidad con código antiguo
 * que importaba desde "@/lib/eventsMiniDb".
 *
 * 👉 Nueva forma recomendada:
 *    import { getMyEvents, createEventForGroup, ... } from "@/lib/eventsDb";
 *
 * Mientras tanto, re-exportamos todo desde eventsDb.
 */

export * from "@/lib/eventsDb";
