# SyncPlans — Location prompt once fix

Objetivo: el prompt de Smart Mobility / ubicación no debe aparecer cada vez que el usuario entra a la app.

Cambios aplicados por el script:

- Agrega una marca local `syncplans:location_prompt_handled`.
- Si el usuario ya respondió una vez, el prompt no vuelve a mostrarse automáticamente.
- Si el permiso del navegador ya está concedido, la app actualiza la ubicación en silencio.
- Si el usuario toca "Luego" o "No por ahora", también queda guardado para no insistir en cada entrada.
- No toca rutas, RLS, backend crítico ni arquitectura.

Aplicación:

```powershell
cd "C:\Users\ASUS\Desktop\SyncPlans\syncplans-app"

Expand-Archive -Path "C:\Users\ASUS\Downloads\syncplans-location-prompt-once-fix.zip" -DestinationPath "." -Force

powershell -ExecutionPolicy Bypass -File "scripts\apply-location-prompt-once-fix.ps1"

npm run lint
npm run build
```

Commit sugerido:

```powershell
git add src/lib/locationPermission.ts src/components/location/LocationPermissionPrompt.tsx scripts/apply-location-prompt-once-fix.ps1 README_LOCATION_PROMPT_ONCE_FIX.md

git commit -m "Show location permission prompt once"

git push
```
