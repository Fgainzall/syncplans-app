import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    rules: {
      /*
       * Bloque 2 — deuda heredada controlada.
       *
       * El build ya está verde con TypeScript estricto.
       * Hay cientos de `any` heredados en módulos existentes; por ahora
       * los dejamos como warning para poder limpiar por capas sin bloquear release.
       */
      "@typescript-eslint/no-explicit-any": "warn",

      /*
       * Seguimos bloqueando cosas peligrosas:
       * - @ts-nocheck
       * - @ts-ignore sin control
       *
       * Permitimos @ts-expect-error solo si incluye explicación.
       */
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": "allow-with-description",
          "ts-ignore": true,
          "ts-nocheck": true,
          "ts-check": false,
          minimumDescriptionLength: 8,
        },
      ],
    },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;