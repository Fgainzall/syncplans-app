# SyncPlans beta groups fix

Cambios incluidos:

1. `src/lib/premium.ts`
   - Activa `BETA_PREMIUM_FOR_ALL = true`.
   - `hasPremiumAccess()` devuelve `true` para todos durante beta, incluso si falta el profile.
   - El snapshot muestra `Beta Premium`.

2. `src/app/groups/new/page.tsx`
   - Para el límite Free futuro, cuenta solo grupos donde el usuario es owner, no grupos donde fue invitado.

3. `src/lib/groupsDb.ts`
   - Elimina una línea duplicada de `memberUserId` que podía romper TypeScript.

Validación esperada:
- Un usuario invitado a un grupo puede crear otro grupo.
- La pantalla de crear grupo ya no muestra el bloqueo Free durante beta.
- `npm run lint` y `npm run build` deben quedar verdes.
