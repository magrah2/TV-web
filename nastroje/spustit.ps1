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

# Zjištěné cesty k nástrojům. Volá se přes ně, ne přes holé `node` a `npm` —
# na počítači, kde Node není v PATH, by holý název nikdo nenašel.
$script:Node = $null
$script:Npm = $null

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

function ZaradDoPath($nodeExe) {
  # Když se Node našel mimo PATH, nestačí si pamatovat cestu k node.exe:
  # `npm` je vedle ležící dávkový soubor a Astro i skripty v nastroje/ si
  # dalšího `node` volají samy. Proto se složka doplní do PATH tohohle
  # procesu — zdědí ho všechno, co odsud spustíme, a nikam se to neukládá.
  $slozka = Split-Path -Parent $nodeExe
  if (($env:Path -split ';') -notcontains $slozka) {
    $env:Path = "$slozka;$env:Path"
  }
}

function NajdiNpm($nodeExe) {
  # npm.cmd leží vedle node.exe. Hledá se přímo tam, ne přes Get-Command:
  # ať se nespoléháme na to, jak rychle si PowerShell všimne čerstvě
  # doplněného PATH.
  $vedle = Join-Path (Split-Path -Parent $nodeExe) 'npm.cmd'
  if (Test-Path $vedle) { return $vedle }

  $vPath = Get-Command npm -ErrorAction SilentlyContinue
  if ($vPath) { return $vPath.Source }

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

  if (-not $node) {
    NapisKrok 'Node.js na tomhle pocitaci neni. Zkusim ho nainstalovat.'
    Napis '   (Node.js je program, ktery web sestavi. Instaluje se jednou.)'

    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
      NapisChybu 'Nepodarilo se to automaticky - chybi instalator winget.'
      Napis '   Stahnete Node.js rucne z https://nodejs.org (verzi LTS),'
      Napis '   nainstalujte ho a spustte tuhle ulohu znovu.'
      exit 1
    }

    winget install --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent | Out-Host
    ObnovPath

    $node = NajdiNode
    if (-not $node) {
      NapisChybu 'Node.js se nainstaloval, ale jeste neni videt.'
      Napis '   Zavrete VS Code, znovu ho otevrete a spustte ulohu znovu.'
      exit 1
    }

    Napis '   Hotovo.'
  }

  ZaradDoPath $node

  $npm = NajdiNpm $node
  if (-not $npm) {
    NapisChybu 'Node.js je na pocitaci, ale npm k nemu chybi.'
    Napis "   Node.js je tady: $node"
    Napis '   Nainstalujte Node.js znovu z https://nodejs.org (verzi LTS).'
    exit 1
  }

  $script:Node = $node
  $script:Npm = $npm
}

function ZajistiBalicky {
  if (Test-Path 'node_modules') { return }
  NapisKrok 'Doplnuji chybejici soucastky (npm install). Chvili to trva.'
  & $script:Npm install
  if ($LASTEXITCODE -ne 0) {
    NapisChybu 'Instalace soucastek se nepovedla. Zkuste to znovu, nebo zavolejte Vojtu.'
    exit 1
  }
}

# ---------------------------------------------------------------------------
#  Běh
# ---------------------------------------------------------------------------

ZajistiNode
ZajistiBalicky

switch ($Prikaz) {
  'priprava' {
    NapisKrok 'Pocitac je pripraveny.'
    Napis '   Ted muzete spustit ulohu "1 - Nahled webu".'
  }

  'nahled' {
    NapisKrok 'Spoustim nahled. Otevre se v prohlizeci.'
    Napis '   Po ulozeni souboru se stranka obnovi sama.'
    Napis '   Nahled zastavite krizkem u tohohle panelu.'
    & $script:Npm run dev -- --open
  }

  'sestavit' {
    NapisKrok 'Sestavuji web.'
    & $script:Npm run build
    if ($LASTEXITCODE -ne 0) { exit 1 }
  }

  'zverejnit' {
    & $script:Node nastroje/zverejnit.mjs
    exit $LASTEXITCODE
  }
}
