# Spouštěč úloh z VS Code.
#
# Proč PowerShell a ne Node: to, co na počítači nejspíš chybí, je právě Node.js.
# Spouštěč napsaný v Node by tedy nešel spustit. Tenhle skript Node najde,
# v nouzi ho doinstaluje, doplní chybějící balíčky a teprve pak spustí,
# co se po něm chce.
#
#   powershell -ExecutionPolicy Bypass -File nastroje/spustit.ps1 nahled
#
# Příkazy: priprava | nahled | sestavit | zverejnit

param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('priprava', 'nahled', 'sestavit', 'zverejnit')]
  [string]$Prikaz
)

$ErrorActionPreference = 'Stop'

# Skript leží v nastroje/, kořen projektu je o patro výš.
$koren = Split-Path -Parent $PSScriptRoot
Set-Location $koren

function Napis($text) { Write-Host $text }
function NapisKrok($text) { Write-Host "`n>> $text" -ForegroundColor Cyan }
function NapisChybu($text) { Write-Host "`n!! $text" -ForegroundColor Red }

# ---------------------------------------------------------------------------
#  Najít Node.js
# ---------------------------------------------------------------------------

function NajdiNode {
  # 1) Je v PATH?
  $vPath = Get-Command node -ErrorAction SilentlyContinue
  if ($vPath) { return $vPath.Source }

  # 2) Obvyklá místa — Node bývá nainstalovaný, jen není v PATH
  $mista = @(
    "$env:ProgramFiles\nodejs\node.exe",
    "${env:ProgramFiles(x86)}\nodejs\node.exe",
    "$env:LOCALAPPDATA\Programs\nodejs\node.exe",
    "$env:APPDATA\npm\node.exe"
  )
  foreach ($misto in $mista) {
    if (Test-Path $misto) { return $misto }
  }

  return $null
}

function ObnovPath {
  # Po instalaci je nový PATH jen v registru, ne v běžícím okně.
  $stroj = [Environment]::GetEnvironmentVariable('Path', 'Machine')
  $uzivatel = [Environment]::GetEnvironmentVariable('Path', 'User')
  $env:Path = "$stroj;$uzivatel"
}

function ZajistiNode {
  $node = NajdiNode
  if ($node) { return $node }

  NapisKrok 'Node.js na tomhle počítači není. Zkusím ho nainstalovat.'
  Napis '   (Node.js je program, který web sestaví. Instaluje se jednou.)'

  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    NapisChybu 'Nepodařilo se to automaticky — chybí instalátor winget.'
    Napis '   Stáhněte Node.js ručně z https://nodejs.org (verzi LTS),'
    Napis '   nainstalujte ho a spusťte tuhle úlohu znovu.'
    exit 1
  }

  winget install --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent
  ObnovPath

  $node = NajdiNode
  if (-not $node) {
    NapisChybu 'Node.js se nainstaloval, ale ještě není vidět.'
    Napis '   Zavřete VS Code, znovu ho otevřete a spusťte úlohu znovu.'
    exit 1
  }

  Napis '   Hotovo.'
  return $node
}

function ZajistiBalicky {
  if (Test-Path 'node_modules') { return }
  NapisKrok 'Doplňuji chybějící součástky (npm install). Chvíli to trvá.'
  & npm install
  if ($LASTEXITCODE -ne 0) {
    NapisChybu 'Instalace součástek se nepovedla. Zkuste to znovu, nebo zavolejte Vojtu.'
    exit 1
  }
}

# ---------------------------------------------------------------------------
#  Běh
# ---------------------------------------------------------------------------

$null = ZajistiNode
ZajistiBalicky

switch ($Prikaz) {
  'priprava' {
    NapisKrok 'Počítač je připravený.'
    Napis '   Teď můžete spustit úlohu "1 - Nahled webu".'
  }

  'nahled' {
    NapisKrok 'Spouštím náhled. Otevře se v prohlížeči.'
    Napis '   Po uložení souboru se stránka obnoví sama.'
    Napis '   Náhled zastavíte křížkem u tohohle panelu.'
    & npm run dev -- --open
  }

  'sestavit' {
    NapisKrok 'Sestavuji web.'
    & npm run build
    if ($LASTEXITCODE -ne 0) { exit 1 }
  }

  'zverejnit' {
    & node nastroje/zverejnit.mjs
    exit $LASTEXITCODE
  }
}
