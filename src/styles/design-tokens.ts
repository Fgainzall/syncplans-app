// src/styles/design-tokens.ts

// 🎨 Paleta base de SyncPlans
// Centraliza todos los colores, radios, sombras y spacing aquí.
// Nada de hex mágicos regados por el proyecto.

export const colors = {
  // Fondo global de la app
  appBackground: "#0B0F19",

  // Superficies
  surfaceLow: "rgba(15, 23, 42, 0.85)",
  surfaceRaised: "rgba(15, 23, 42, 0.96)",

  // Bordes
  borderSubtle: "rgba(148, 163, 184, 0.35)",
  borderStrong: "rgba(148, 163, 184, 0.55)",

  // Texto
  textPrimary: "#F9FAFB",
  textSecondary: "#9CA3AF",
  textMuted: "rgba(148, 163, 184, 0.9)",

  // Acentos
  accentPrimary: "#38BDF8",
  accentSecondary: "#A855F7",
  accentWarning: "#FBBF24",
  accentDanger: "#FB7185",

  // Separadores
  dividerSoft: "rgba(15, 23, 42, 0.8)",
};

// 🧱 Radios reutilizables
export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  full: 999,
};

// 🌫 Sombras reutilizables
export const shadows = {
  soft: "0 18px 45px rgba(15, 23, 42, 0.45)",
  card:
    "0 16px 40px rgba(15, 23, 42, 0.55), 0 0 0 1px rgba(148, 163, 184, 0.35)",
  inner:
    "inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(148, 163, 184, 0.32)",
};

// 📏 Espaciado base
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 40,
};

// 📐 Layout global
export const layout = {
  maxWidthMobile: 520,
  maxWidthDesktop: 1120, // 🆕 ancho “dashboard” para escritorio
  mobileBreakpoint: 768,
  mobileBottomSafe: 72,
};