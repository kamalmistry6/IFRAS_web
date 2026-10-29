<#
.SYNOPSIS
  Builds the web app and puts it on the server.

.DESCRIPTION
  1. runs the production build (it talks to the API on its own address, /api/v1),
  2. packs the result and uploads it over SSH with your key,
  3. on the server, unpacks it into a new folder under /srv/ifras_web/releases and switches the
     `current` link to it, so visitors never see a half-copied site and the last releases can be
     switched back to.

  Run it from the IFRAS_web folder. The server needs the domain set up first (setup-domain.sh in the
  API repository).

.EXAMPLE
  .\deploy\deploy-web.ps1 -Server ifras.kamalmistry.in -Key $env:USERPROFILE\.ssh\ifras_server

  Or set the two values once for the PowerShell session:
    $env:IFRAS_SERVER = 'ifras.kamalmistry.in'
    $env:IFRAS_KEY    = "$env:USERPROFILE\.ssh\ifras_server"
    .\deploy\deploy-web.ps1

.EXAMPLE
  .\deploy\deploy-web.ps1 -Rollback    # switch back to the release before the current one
#>
param(
  [string]$Server = $env:IFRAS_SERVER,
  [string]$Key = $env:IFRAS_KEY,
  [string]$User = 'ifras',
  [string]$Remote = '/srv/ifras_web',
  [int]$Keep = 5,
  [switch]$SkipTests,
  [switch]$Rollback
)

$ErrorActionPreference = 'Stop'

if (-not $Server) { throw 'Give the server: -Server ifras.kamalmistry.in (or set $env:IFRAS_SERVER).' }

$sshArgs = @('-o', 'BatchMode=yes')
if ($Key) { $sshArgs += @('-i', $Key) }
$target = "$User@$Server"

if ($Rollback) {
  $script = @'
set -euo pipefail
cd __REMOTE__/releases
current=$(basename "$(readlink -f __REMOTE__/current)")
previous=$(ls -1 | grep -v '^placeholder$' | sort | grep -B1 -x "$current" | head -n1)
if [ -z "$previous" ] || [ "$previous" = "$current" ]; then echo 'There is no earlier release to go back to.' >&2; exit 1; fi
ln -sfn __REMOTE__/releases/$previous __REMOTE__/current
echo "Now serving $previous (was $current)"
'@
  $script = $script.Replace('__REMOTE__', $Remote).Replace("`r", '')
  ssh @sshArgs $target $script
  if ($LASTEXITCODE -ne 0) { throw 'The rollback failed.' }
  return
}

Set-Location (Split-Path -Parent $PSScriptRoot)

if (-not $SkipTests) {
  Write-Host 'Running the tests ...'
  npx ng test --no-watch
  if ($LASTEXITCODE -ne 0) { throw 'The tests failed, nothing was deployed. (Use -SkipTests to deploy anyway.)' }
}

Write-Host 'Building ...'
npx ng build
if ($LASTEXITCODE -ne 0) { throw 'The build failed.' }

$dist = Join-Path (Get-Location) 'dist\face-attendance\browser'
if (-not (Test-Path (Join-Path $dist 'index.html'))) { throw "No build found in $dist" }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$archive = Join-Path ([System.IO.Path]::GetTempPath()) "ifras-web-$stamp.tgz"

Write-Host 'Packing ...'
tar -czf $archive -C $dist .
if ($LASTEXITCODE -ne 0) { throw 'Could not pack the build (tar failed).' }

try {
  Write-Host "Uploading to $target ..."
  scp @sshArgs $archive "${target}:/tmp/ifras-web-$stamp.tgz"
  if ($LASTEXITCODE -ne 0) { throw 'The upload failed.' }

  $script = @'
set -euo pipefail
release=__REMOTE__/releases/__STAMP__
mkdir -p "$release"
tar -xzf /tmp/ifras-web-__STAMP__.tgz -C "$release"
rm -f /tmp/ifras-web-__STAMP__.tgz
test -f "$release/index.html"
ln -sfn "$release" __REMOTE__/current
# keep the newest releases, drop the rest (never the one being served, never the placeholder)
cd __REMOTE__/releases
ls -1 | grep -v '^placeholder$' | sort | head -n -__KEEP__ | xargs -r rm -rf
echo "Serving __STAMP__"
'@
  $script = $script.Replace('__REMOTE__', $Remote).Replace('__STAMP__', $stamp).Replace('__KEEP__', [string]$Keep).Replace("`r", '')
  ssh @sshArgs $target $script
  if ($LASTEXITCODE -ne 0) { throw 'Could not switch to the new release on the server.' }
}
finally {
  Remove-Item $archive -ErrorAction SilentlyContinue
}

Write-Host "Done: https://$Server/" -ForegroundColor Green
