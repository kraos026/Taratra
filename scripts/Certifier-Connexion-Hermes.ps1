param([string]$BridgeConfigPath = $env:OPTIVOS_HERMES_BRIDGE_CONFIG)
$ErrorActionPreference = 'Stop'
$recipeRoot = Split-Path $PSScriptRoot -Parent
if (!$BridgeConfigPath) {
  $localReference = Join-Path $recipeRoot 'artifacts/hermes-connection-live/connection-local.json'
  if (Test-Path -LiteralPath $localReference) {
    $BridgeConfigPath = (Get-Content -LiteralPath $localReference -Raw | ConvertFrom-Json).bridgeConfig
  }
}
if (!$BridgeConfigPath -or !(Test-Path -LiteralPath $BridgeConfigPath)) {
  throw 'Indiquez le fichier connection.json du pont Hermes existant avec -BridgeConfigPath.'
}
$bridge = Get-Content -LiteralPath $BridgeConfigPath -Raw | ConvertFrom-Json
$hostPattern = [regex]::Escape($bridge.tunnel.host)
$existingPorts = @(Get-CimInstance Win32_Process -Filter "name='ssh.exe'" | ForEach-Object {
  if ($_.CommandLine -match $hostPattern) {
    $match = [regex]::Match($_.CommandLine, '127\.0\.0\.1:(\d+):127\.0\.0\.1:8642')
    if ($match.Success) { $match.Groups[1].Value }
  }
} | Select-Object -Unique)
if ($existingPorts.Count -ne 1) {
  throw 'Un tunnel API Hermes unique doit déjà être ouvert. Vérifiez Hermes dans Codex puis relancez cette recette.'
}
$previousBridge = $env:OPTIVOS_HERMES_BRIDGE_CONFIG
$previousTunnel = $env:OPTIVOS_HERMES_EXISTING_TUNNEL_URL
Push-Location -LiteralPath $recipeRoot
try {
  $env:OPTIVOS_HERMES_BRIDGE_CONFIG = $BridgeConfigPath
  $env:OPTIVOS_HERMES_EXISTING_TUNNEL_URL = "http://127.0.0.1:$($existingPorts[0])"
  & node (Join-Path $PSScriptRoot 'certify-hermes-connection.mjs')
  if ($LASTEXITCODE -ne 0) { throw 'La recette a échoué ; consulter les preuves locales sans secret.' }
} finally {
  $env:OPTIVOS_HERMES_BRIDGE_CONFIG = $previousBridge
  $env:OPTIVOS_HERMES_EXISTING_TUNNEL_URL = $previousTunnel
  Pop-Location
}
