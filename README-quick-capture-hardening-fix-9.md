# SyncPlans Quick Capture Hardening Fix 9

Cambio quirúrgico sobre `src/app/summary/SummaryClient.tsx`.

Objetivo:
- Corregir frases complejas de Quick Capture con contexto familiar y rangos horarios.
- Evitar que `donde mi tío Lucho` o `en la casa de Pepito` entren como ubicación.
- Evitar que `hasta las 5` se convierta en nota o contexto roto.
- Enviar a la pantalla de detalle una hora de inicio, fin y duración más fieles.

Ejemplo esperado:
`Parrilla familiar con Ara, mis papás y mis primos donde mi tío Lucho el domingo 24 a la 1:30 pm hasta las 5, llevar hielo, postre y confirmar quién recoge a la abuela`

Debe interpretarse como:
- Inicio: domingo 24, 1:30 PM
- Fin: domingo 24, 5:00 PM
- Duración: 210 min
- Ubicación: vacía
- Notas: `Llevar hielo, postre y confirmar quién recoge a la abuela.\nContexto: donde mi tío Lucho.`
