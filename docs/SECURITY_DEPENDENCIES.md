# SyncPlans — Security Dependencies Review

Fecha: 2026-05-04

## Estado ejecutivo

`npm audit --omit=dev` y `npm audit` ya no fallan por 403 en el entorno local auditado. Ambos comandos devolvieron resultados legibles.

Resultado actual:

- Vulnerabilidades productivas críticas: 0
- Vulnerabilidades productivas altas: 0
- Vulnerabilidades productivas moderadas: 2
- Vulnerabilidades dev críticas/altas adicionales: 0

## Hallazgo principal

| Paquete | Severidad | Tipo | Origen | Estado recomendado |
|---|---:|---|---|---|
| postcss | Moderada | Transitive prod | `next` incluye `postcss@8.4.31` | Mitigar/documentar; no usar `npm audit fix --force` |
| next | Moderada | Direct prod | reportado por dependencia transitiva `postcss` | No downgrade; esperar/validar patch seguro |

## Detalle técnico

El `package-lock.json` muestra:

- `next`: `16.2.4`
- `node_modules/next/node_modules/postcss`: `8.4.31`
- `node_modules/postcss`: `8.5.12`

La vulnerabilidad reportada corresponde a `postcss < 8.5.10`, pero el caso concreto entra por la copia anidada bajo `next`. `npm audit` propone un fix extraño/downgrade mayor hacia `next@9.3.3`; esa acción NO debe aplicarse porque rompe la línea actual de Next 16 y no es una remediación razonable para este proyecto.

## Decisión actual

Para beta cerrada, este punto queda como riesgo moderado aceptado temporalmente porque:

1. No hay vulnerabilidades críticas ni altas en dependencias productivas.
2. El hallazgo es transitive vía Next/PostCSS.
3. No se debe ejecutar `npm audit fix --force`.
4. El riesgo queda documentado y monitorizado.

## Próximas acciones recomendadas

1. Revisar si `next` publica patch que actualice su `postcss` interno.
2. Probar en rama separada un override controlado:

```json
{
  "overrides": {
    "postcss": "8.5.14"
  }
}
```

3. Después de probar override:

```powershell
npm install
npm run lint
npm run build
npm audit --omit=dev
```

4. Si build y smoke pasan, considerar commit separado:

```txt
Patch PostCSS audit advisory
```

## Criterio de cierre

- Ideal: `npm audit --omit=dev` con 0 vulnerabilidades.
- Aceptable para beta cerrada: 0 críticas / 0 altas productivas, moderadas documentadas con plan.
