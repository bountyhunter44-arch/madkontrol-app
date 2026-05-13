param(
  [Parameter(Mandatory = $true)]
  [string]$FirebaseIdToken,

  [Parameter(Mandatory = $true)]
  [string]$CompanyId,

  [Parameter(Mandatory = $true)]
  [string]$LocationId,

  [string]$DeniedCompanyId = "company_denied",
  [string]$DeniedLocationId = "location_denied"
)

$ErrorActionPreference = "Stop"

$url = "https://us-central1-madkontrollen.cloudfunctions.net/getLexiCustomerStatus"

function Invoke-Callable {
  param(
    [string]$Company,
    [string]$Location
  )

  $headers = @{
    "Authorization" = "Bearer $FirebaseIdToken"
  }

  $body = @{
    data = @{
      companyId = $Company
      locationId = $Location
    }
  } | ConvertTo-Json -Depth 8

  try {
    $response = Invoke-RestMethod -Method Post -Uri $url -Headers $headers -ContentType "application/json" -Body $body
    return @{
      ok = $true
      payload = $response
    }
  } catch {
    $statusCode = 0
    $errorBody = ""

    if ($_.Exception.Response -ne $null) {
      $statusCode = [int]$_.Exception.Response.StatusCode
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $reader.BaseStream.Position = 0
      $reader.DiscardBufferedData()
      $errorBody = $reader.ReadToEnd()
    } else {
      $errorBody = $_.Exception.Message
    }

    return @{
      ok = $false
      statusCode = $statusCode
      errorBody = $errorBody
    }
  }
}

Write-Host "1) AUTH success-test (forventet: ok=true)" -ForegroundColor Cyan
$success = Invoke-Callable -Company $CompanyId -Location $LocationId
if (-not $success.ok) {
  Write-Host "Fejl i success-test" -ForegroundColor Red
  Write-Host ("HTTP: {0}" -f $success.statusCode)
  Write-Host $success.errorBody
  exit 1
}

$successPayload = $success.payload.result
if (-not $successPayload) {
  Write-Host "Mangler result i callable-svar" -ForegroundColor Red
  $success.payload | ConvertTo-Json -Depth 8
  exit 1
}

Write-Host "Success-test OK" -ForegroundColor Green
Write-Host ("status={0}, operatingMode={1}, antal_rutiner={2}, antal_forfaldne_rutiner={3}" -f $successPayload.status, $successPayload.operatingMode, $successPayload.antal_rutiner, $successPayload.antal_forfaldne_rutiner)

Write-Host ""
Write-Host "2) AUTH denied-test (forventet: permission-denied eller lign.)" -ForegroundColor Cyan
$denied = Invoke-Callable -Company $DeniedCompanyId -Location $DeniedLocationId

if ($denied.ok) {
  Write-Host "ADVARSEL: denied-test gav adgang (tjek test IDs)." -ForegroundColor Yellow
  $denied.payload | ConvertTo-Json -Depth 8
  exit 2
}

Write-Host "Denied-test OK (adgang afvist)" -ForegroundColor Green
Write-Host ("HTTP: {0}" -f $denied.statusCode)
Write-Host $denied.errorBody

Write-Host ""
Write-Host "Callable auth-test gennemfoert." -ForegroundColor Green
