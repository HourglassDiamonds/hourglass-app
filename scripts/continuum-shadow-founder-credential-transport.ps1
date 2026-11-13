function Add-ContinuumShadowFounderEnvVariable {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [string]$VercelPath,

    [Parameter(Mandatory = $true)]
    [string]$ProjectId,

    [Parameter(Mandatory = $true)]
    [string]$TeamId,

    [Parameter(Mandatory = $true)]
    [string]$Key,

    [Parameter(Mandatory = $true)]
    [string]$Value,

    [Parameter(Mandatory = $true)]
    [string]$Comment
  )

  $body = [ordered]@{
    key = $Key
    value = $Value
    type = 'sensitive'
    target = @('production')
    comment = $Comment
  } | ConvertTo-Json -Depth 5 -Compress

  try {
    $responseRaw = $body | & $VercelPath api (
      "/v10/projects/$ProjectId/env?teamId=$TeamId"
    ) -X POST --input - --raw
    if ($LASTEXITCODE -ne 0) {
      throw "Vercel rejected temporary environment variable $Key."
    }

    $response = $responseRaw | ConvertFrom-Json
    if (@($response.failed).Count -gt 0) {
      throw "Vercel did not create temporary environment variable $Key."
    }
    $created = if ($response.created) { $response.created } else { $response }
    if (-not $created.id -or $created.key -ne $Key) {
      throw "Vercel returned an invalid receipt for temporary environment variable $Key."
    }

    [ordered]@{ id = $created.id; key = $created.key }
  } finally {
    $body = $null
    $responseRaw = $null
  }
}
