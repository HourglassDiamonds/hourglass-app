[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-f0-9]{40}$')]
  [string]$ExpectedSourceSha,

  [string]$ProjectId = 'prj_bo3WR8iqDpL6gJTGUZCzwqBfqAqV',
  [string]$TeamId = 'team_KkvkPNf78xIJvm49MBPnqPmj'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$usernameKey = 'CONTINUUM_PRODUCTION_SHADOW_FOUNDER_USERNAME'
$passwordHashKey = 'CONTINUUM_PRODUCTION_SHADOW_FOUNDER_PASSWORD_HASH'
$repoRoot = Split-Path -Parent $PSScriptRoot
$actualSha = (& git -C $repoRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $actualSha -ne $ExpectedSourceSha) {
  throw 'The local source SHA does not match the reviewed shadow-auth candidate.'
}

$vercel = (Get-Command vercel -ErrorAction SilentlyContinue).Source
if (-not $vercel) {
  $fallback = Join-Path $env:APPDATA 'npm\vercel.cmd'
  if (Test-Path -LiteralPath $fallback) {
    $vercel = $fallback
  }
}
if (-not $vercel) {
  throw 'Authenticated Vercel CLI not found.'
}

$tempRoot = Join-Path $env:LOCALAPPDATA 'Temp'
$manifestDir = Join-Path $tempRoot (
  'continuum-shadow-auth-' + [guid]::NewGuid().ToString('D')
)
New-Item -ItemType Directory -Path $manifestDir -ErrorAction Stop | Out-Null
& icacls.exe $manifestDir '/inheritance:r' '/grant:r' (
  $env:USERNAME + ':(OI)(CI)F'
) | Out-Null

$manifestPath = Join-Path $manifestDir 'manifest.json'
$watchdogPath = Join-Path $manifestDir 'watchdog.ps1'
$completePath = Join-Path $manifestDir 'cleanup.complete'
$startedAtMs = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

function Write-Manifest([object[]]$created) {
  $payload = [ordered]@{
    contract = 'continuum-shadow-founder-auth-temp-v1'
    projectId = $ProjectId
    teamId = $TeamId
    sourceSha = $ExpectedSourceSha
    startedAtMs = $startedAtMs
    keys = @($usernameKey, $passwordHashKey)
    created = $created
  }
  $temporary = $manifestPath + '.tmp'
  [IO.File]::WriteAllText(
    $temporary,
    ($payload | ConvertTo-Json -Depth 6),
    [Text.UTF8Encoding]::new($false)
  )
  Move-Item -LiteralPath $temporary -Destination $manifestPath -Force
}

Write-Manifest @()

$watchdog = @'
param(
  [string]$ManifestPath,
  [string]$CompletePath,
  [string]$VercelPath
)
$ErrorActionPreference = 'Stop'
Start-Sleep -Seconds 1800
if (Test-Path -LiteralPath $CompletePath) { exit 0 }
$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
$created = @($manifest.created)
if ($created.Count -eq 0) {
  $endpoint = "/v9/projects/$($manifest.projectId)/env?decrypt=false&teamId=$($manifest.teamId)"
  $raw = & $VercelPath api $endpoint -X GET --raw
  if ($LASTEXITCODE -eq 0) {
    $response = $raw | ConvertFrom-Json
    $envs = if ($response.envs) { @($response.envs) } else { @($response) }
    $created = @(
      $envs | Where-Object {
        $_.key -in @($manifest.keys) -and
        'production' -in @($_.target) -and
        [int64]$_.createdAt -ge [int64]$manifest.startedAtMs
      } | ForEach-Object { [pscustomobject]@{ id = $_.id; key = $_.key } }
    )
  }
}
foreach ($entry in $created) {
  if (-not $entry.id) { continue }
  $endpoint = "/v9/projects/$($manifest.projectId)/env/$($entry.id)?teamId=$($manifest.teamId)"
  & $VercelPath api $endpoint -X DELETE --dangerously-skip-permissions --silent
}
'@
[IO.File]::WriteAllText(
  $watchdogPath,
  $watchdog,
  [Text.UTF8Encoding]::new($false)
)

Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -ArgumentList @(
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-File', $watchdogPath,
  '-ManifestPath', $manifestPath,
  '-CompletePath', $completePath,
  '-VercelPath', $vercel
) | Out-Null

$existingRaw = & $vercel api (
  "/v9/projects/$ProjectId/env?decrypt=false&teamId=$TeamId"
) -X GET --raw
if ($LASTEXITCODE -ne 0) {
  throw 'Unable to verify existing Vercel environment-variable metadata.'
}
$existingResponse = $existingRaw | ConvertFrom-Json
$existing = if ($existingResponse.envs) {
  @($existingResponse.envs)
} else {
  @($existingResponse)
}
$conflicts = @(
  $existing | Where-Object {
    $_.key -in @($usernameKey, $passwordHashKey) -and
    'production' -in @($_.target)
  }
)
if ($conflicts.Count -gt 0) {
  throw 'A shadow founder credential variable already exists; no value was changed.'
}

$username = (Read-Host 'Choose the temporary Sterling shadow username').Trim()
if (-not $username) {
  throw 'A non-empty username is required.'
}
$passwordSecure = Read-Host 'Choose the temporary Sterling shadow password' -AsSecureString
$confirmSecure = Read-Host 'Confirm the temporary Sterling shadow password' -AsSecureString
$passwordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($passwordSecure)
$confirmPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($confirmSecure)
$passwordPlain = $null
$confirmPlain = $null
try {
  $passwordPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPtr)
  $confirmPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($confirmPtr)
  if (
    -not $passwordPlain -or
    -not [string]::Equals(
      $passwordPlain,
      $confirmPlain,
      [StringComparison]::Ordinal
    )
  ) {
    throw 'The password confirmation did not match.'
  }
  $hashScript = Join-Path $repoRoot 'scripts\hash-executive-dashboard-password.mjs'
  $passwordHash = (
    $passwordPlain | & node --no-warnings $hashScript
  ).Trim()
  if ($LASTEXITCODE -ne 0 -or $passwordHash -notmatch '^scrypt\$') {
    throw 'Password hashing failed.'
  }
} finally {
  if ($passwordPtr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr)
  }
  if ($confirmPtr -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($confirmPtr)
  }
  $passwordPlain = $null
  $confirmPlain = $null
}

$request = @(
  [ordered]@{
    key = $usernameKey
    value = $username
    type = 'sensitive'
    target = @('production')
    comment = 'Temporary exact-runtime Sterling shadow founder username'
  },
  [ordered]@{
    key = $passwordHashKey
    value = $passwordHash
    type = 'sensitive'
    target = @('production')
    comment = 'Temporary exact-runtime Sterling shadow founder password hash'
  }
) | ConvertTo-Json -Depth 5

try {
  $responseRaw = $request | & $vercel api (
    "/v10/projects/$ProjectId/env?teamId=$TeamId"
  ) -X POST --input - --raw
  if ($LASTEXITCODE -ne 0) {
    throw 'Vercel rejected the temporary credential variables.'
  }
  $response = $responseRaw | ConvertFrom-Json
  $createdRows = if ($response.created -is [array]) {
    @($response.created)
  } elseif ($response.created) {
    @($response.created)
  } elseif ($response -is [array]) {
    @($response)
  } else {
    @($response)
  }
  $created = @(
    $createdRows |
      Where-Object { $_.id -and $_.key -in @($usernameKey, $passwordHashKey) } |
      ForEach-Object { [ordered]@{ id = $_.id; key = $_.key } }
  )
  if ($created.Count -ne 2) {
    throw 'Vercel did not return both temporary credential IDs.'
  }
  Write-Manifest $created
} finally {
  $request = $null
  $passwordHash = $null
  $username = $null
}

Write-Output 'Temporary shadow credentials are set.'
Write-Output ('Manifest: ' + $manifestPath)
Write-Output 'No credential value was written to the manifest or printed.'
