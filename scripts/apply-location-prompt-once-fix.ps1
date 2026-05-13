$ErrorActionPreference = "Stop"

function Assert-FileExists($path) {
  if (!(Test-Path $path)) {
    throw "No existe el archivo requerido: $path"
  }
}

function Write-FileUtf8NoBom($path, $content) {
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText((Resolve-Path $path), $content, $utf8NoBom)
}

$libPath = "src\lib\locationPermission.ts"
$promptPath = "src\components\location\LocationPermissionPrompt.tsx"

Assert-FileExists $libPath
Assert-FileExists $promptPath

$lib = Get-Content $libPath -Raw
$prompt = Get-Content $promptPath -Raw

# -----------------------------------------------------------------------------
# 1) src/lib/locationPermission.ts
#    Agrega una marca local estable: el prompt ya fue atendido una vez.
# -----------------------------------------------------------------------------
if ($lib -notmatch "HANDLED_KEY") {
  $lib = $lib.Replace(
    'const GRANTED_AT_KEY = "syncplans:location_prompt_granted_at";',
    'const GRANTED_AT_KEY = "syncplans:location_prompt_granted_at";' + "`r`n" +
    'const HANDLED_KEY = "syncplans:location_prompt_handled";'
  )
}

if ($lib -notmatch "function markLocationPromptHandled") {
  $insertAfter = @'
export function clearLocationPromptSnooze() {
  try {
    window.localStorage.removeItem(DISMISSED_UNTIL_KEY);
  } catch {}
}
'@

  $handledFunctions = @'
export function markLocationPromptHandled() {
  try {
    window.localStorage.setItem(HANDLED_KEY, "1");
  } catch {}
}

export function wasLocationPromptHandled() {
  try {
    return window.localStorage.getItem(HANDLED_KEY) === "1";
  } catch {
    return false;
  }
}

'@

  if ($lib.Contains($insertAfter)) {
    $lib = $lib.Replace($insertAfter, $insertAfter + "`r`n" + $handledFunctions)
  } else {
    throw "No pude insertar markLocationPromptHandled en locationPermission.ts. Revisa manualmente el archivo."
  }
}

if ($lib -notmatch "function clearLocationPromptHandled") {
  $afterHandled = @'
export function wasLocationPromptHandled() {
  try {
    return window.localStorage.getItem(HANDLED_KEY) === "1";
  } catch {
    return false;
  }
}
'@

  $clearHandled = @'

export function clearLocationPromptHandled() {
  try {
    window.localStorage.removeItem(HANDLED_KEY);
  } catch {}
}
'@

  if ($lib.Contains($afterHandled)) {
    $lib = $lib.Replace($afterHandled, $afterHandled + $clearHandled)
  }
}

# snooze = el usuario ya vio la pregunta y decidió no hacerlo ahora.
if ($lib -notmatch 'window\.localStorage\.setItem\(HANDLED_KEY, "1"\);\s*\r?\n\s*window\.localStorage\.setItem\(DISMISSED_UNTIL_KEY') {
  $lib = $lib.Replace(
    'window.localStorage.setItem(DISMISSED_UNTIL_KEY, String(until));',
    'window.localStorage.setItem(HANDLED_KEY, "1");' + "`r`n" +
    '    window.localStorage.setItem(DISMISSED_UNTIL_KEY, String(until));'
  )
}

# denied = también queda recordado para no insistir.
if ($lib -notmatch 'window\.localStorage\.setItem\(HANDLED_KEY, "1"\);\s*\r?\n\s*window\.localStorage\.setItem\(DENIED_KEY') {
  $lib = $lib.Replace(
    'window.localStorage.setItem(DENIED_KEY, "1");',
    'window.localStorage.setItem(HANDLED_KEY, "1");' + "`r`n" +
    '    window.localStorage.setItem(DENIED_KEY, "1");'
  )
}

# granted = queda recordado de forma estable, además del timestamp existente.
if ($lib -notmatch 'window\.localStorage\.setItem\(HANDLED_KEY, "1"\);\s*\r?\n\s*window\.localStorage\.setItem\(GRANTED_KEY') {
  $lib = $lib.Replace(
    'window.localStorage.setItem(GRANTED_KEY, "1");',
    'window.localStorage.setItem(HANDLED_KEY, "1");' + "`r`n" +
    '    window.localStorage.setItem(GRANTED_KEY, "1");'
  )
}

Write-FileUtf8NoBom $libPath $lib

# -----------------------------------------------------------------------------
# 2) src/components/location/LocationPermissionPrompt.tsx
#    No vuelve a mostrar el prompt si ya fue atendido. Si el permiso del navegador
#    ya está concedido, refresca ubicación en silencio.
# -----------------------------------------------------------------------------
if ($prompt -notmatch "markLocationPromptHandled") {
  $prompt = $prompt.Replace(
    'isLocationPromptSnoozed,',
    'isLocationPromptSnoozed,' + "`r`n" + '  markLocationPromptHandled,'
  )
}

if ($prompt -notmatch "wasLocationPromptHandled") {
  $prompt = $prompt.Replace(
    'wasLocationPromptGranted,',
    'wasLocationPromptGranted,' + "`r`n" + '  wasLocationPromptHandled,'
  )
}

# Después de state === granted, si ya fue manejado antes, no mostrar más el prompt.
if ($prompt -notmatch "wasLocationPromptHandled\(\)\) \{") {
  $needle = @'
      if (state === "granted") {
        await refreshLocationSilently();
        return;
      }
'@

  $replacement = @'
      if (state === "granted") {
        await refreshLocationSilently();
        return;
      }

      if (wasLocationPromptHandled()) {
        return;
      }
'@

  if ($prompt.Contains($needle)) {
    $prompt = $prompt.Replace($needle, $replacement)
  } else {
    throw "No pude insertar el guard de wasLocationPromptHandled en LocationPermissionPrompt.tsx. Revisa manualmente el archivo."
  }
}

# Si el backend dice granted, dismissed o denied, también marca localmente como manejado.
if ($prompt -notmatch "markLocationPromptHandled\(\);\s*\r?\n\s*markLocationPromptGranted\(\);") {
  $prompt = $prompt.Replace(
    'markLocationPromptGranted();' + "`r`n" + '          void refreshLocationSilently();',
    'markLocationPromptHandled();' + "`r`n" + '          markLocationPromptGranted();' + "`r`n" + '          void refreshLocationSilently();'
  )
}

if ($prompt -notmatch "markLocationPromptHandled\(\);\s*\r?\n\s*clearLocationPromptGranted\(\);\s*\r?\n\s*markLocationPromptDenied\(\);") {
  $prompt = $prompt.Replace(
    'clearLocationPromptGranted();' + "`r`n" + '          markLocationPromptDenied();' + "`r`n" + '          return;',
    'markLocationPromptHandled();' + "`r`n" + '          clearLocationPromptGranted();' + "`r`n" + '          markLocationPromptDenied();' + "`r`n" + '          return;'
  )
}

# Persisted dismissed: antes volvía a mostrarse al vencer dismissedUntil. Ahora se considera una decisión ya tomada.
$oldDismissed = @'
        if (persisted?.promptStatus === "dismissed") {
          snoozeLocationPromptUntil(persisted.dismissedUntil);
          if (persisted.dismissedUntil && Date.parse(persisted.dismissedUntil) > Date.now()) {
            return;
          }
        }
'@

$newDismissed = @'
        if (persisted?.promptStatus === "dismissed") {
          markLocationPromptHandled();
          snoozeLocationPromptUntil(persisted.dismissedUntil);
          return;
        }
'@

if ($prompt.Contains($oldDismissed)) {
  $prompt = $prompt.Replace($oldDismissed, $newDismissed)
}

# En acciones del usuario, dejamos explícito que el prompt ya fue atendido.
if ($prompt -notmatch 'async function handleLater\(\) \{\s*\r?\n\s*markLocationPromptHandled\(\);') {
  $prompt = $prompt.Replace(
    'async function handleLater() {' + "`r`n" + '    snoozeLocationPrompt(7);',
    'async function handleLater() {' + "`r`n" + '    markLocationPromptHandled();' + "`r`n" + '    snoozeLocationPrompt(3650);'
  )
}

if ($prompt -notmatch 'async function handleNoThanks\(\) \{\s*\r?\n\s*markLocationPromptHandled\(\);') {
  $prompt = $prompt.Replace(
    'async function handleNoThanks() {' + "`r`n" + '    clearLocationPromptGranted();',
    'async function handleNoThanks() {' + "`r`n" + '    markLocationPromptHandled();' + "`r`n" + '    clearLocationPromptGranted();'
  )
}

# Si el usuario intentó activar y hubo error no-permission/timeout, no insistimos en cada entrada.
if ($prompt -notmatch 'else \{\s*\r?\n\s*markLocationPromptHandled\(\);\s*\r?\n\s*snoozeLocationPrompt\(3650\);') {
  $prompt = $prompt.Replace(
    '      } else {' + "`r`n" + '        snoozeLocationPrompt(1);',
    '      } else {' + "`r`n" + '        markLocationPromptHandled();' + "`r`n" + '        snoozeLocationPrompt(3650);'
  )
}

Write-FileUtf8NoBom $promptPath $prompt

Write-Host "Fix aplicado: LocationPermissionPrompt ahora se muestra solo una vez y queda recordado."
