# SyncPlans — Smoke Test Beta Cerrada

Fecha: 2026-05-04

## Objetivo

Validar los 17 flujos críticos antes de beta cerrada con 5–10 usuarios.

## Reglas

- Usar 2 cuentas reales: Usuario A y Usuario B.
- Probar desktop Chrome y móvil Safari/Chrome.
- Registrar screenshot, resultado y requestId cuando aplique.
- Criterio: 0 blockers antes de beta.

## Matriz de pruebas

| # | Flujo | Resultado | Evidencia | RequestId / notas |
|---:|---|---|---|---|
| 1 | Registro/login/logout/relogin | ⬜ |  |  |
| 2 | Onboarding completo y persistencia | ⬜ |  |  |
| 3 | Crear grupo pair/family | ⬜ |  |  |
| 4 | Invitar segundo usuario por email | ⬜ |  |  |
| 5 | Aceptar invitación desde link | ⬜ |  |  |
| 6 | Crear evento personal | ⬜ |  |  |
| 7 | Crear evento de grupo | ⬜ |  |  |
| 8 | Detectar conflicto real | ⬜ |  |  |
| 9 | Resolver conflicto y persistir decisión | ⬜ |  |  |
| 10 | Notificaciones in-app lectura/no lectura | ⬜ |  |  |
| 11 | Google connect + callback + status | ⬜ |  |  |
| 12 | Google sync trae eventos y no duplica | ⬜ |  |  |
| 13 | Smart Mobility autocomplete + ETA | ⬜ |  |  |
| 14 | Public invite GET/POST expiración/rate limit | ⬜ |  |  |
| 15 | Mobile layout navegación CTA | ⬜ |  |  |
| 16 | Crons daily/weekly/leave con secreto válido/inválido | ⬜ |  |  |
| 17 | Emails entrega/template/links correctos | ⬜ |  |  |

## Severidad

- Blocker: impide flujo core.
- High: flujo core funciona con workaround.
- Medium: fricción importante pero no bloqueante.
- Low: polish.

## Criterio de cierre

- 17/17 ejecutados.
- 0 blockers.
- Highs documentados con workaround o fix planeado.
