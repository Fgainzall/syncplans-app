# SyncPlans clarity fix 2

Este fix corrige el flash inicial del Resumen.

Problema observado:
- Al entrar a /summary, por unos segundos aparecía “Crea tu primer grupo compartido”.
- Luego la pantalla cambiaba a otro estado real, por ejemplo “Invita a otra persona”.
- Eso confundía porque la app mostraba un CTA antes de terminar de cargar grupos/eventos.

Cambio aplicado:
- Summary ya no muestra el estado de “primer grupo” mientras está resolviendo el resumen inicial.
- Muestra una tarjeta neutral: “Estamos cargando tu resumen real”.
- Recién después decide si corresponde crear grupo, invitar, resolver conflictos o revisar eventos.

Archivos tocados:
- src/app/summary/SummaryClient.tsx

No toca backend, RLS, Supabase, auth, Google Calendar, Smart Mobility ni motor de conflictos.
