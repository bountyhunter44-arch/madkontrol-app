param(
  [Parameter(Mandatory = $true)]
  [string]$CompanyId,

  [Parameter(Mandatory = $true)]
  [string]$LocationId,

  [Parameter(Mandatory = $true)]
  [string]$MadkontrolApiBaseUrl,

  [Parameter(Mandatory = $true)]
  [string]$LexiVoiceBaseUrl,

  [string]$ApiKey = ""
)

$ErrorActionPreference = "Stop"

function Invoke-JsonGet {
  param(
    [string]$Url,
    [hashtable]$Headers
  )

  return Invoke-RestMethod -Method Get -Uri $Url -Headers $Headers
}

function Invoke-JsonPost {
  param(
    [string]$Url,
    [hashtable]$Headers,
    [object]$Body
  )

  return Invoke-RestMethod -Method Post -Uri $Url -Headers $Headers -ContentType "application/json" -Body ($Body | ConvertTo-Json -Depth 10)
}

$safeMadkontrolBase = $MadkontrolApiBaseUrl.TrimEnd("/")
$safeLexiBase = $LexiVoiceBaseUrl.TrimEnd("/")

$headers = @{}
if ($ApiKey -and $ApiKey.Trim() -ne "") {
  $headers["x-api-key"] = $ApiKey.Trim()
}

$madkontrolUrl = "$safeMadkontrolBase/lexivoice/customer-context?companyId=$CompanyId&locationId=$LocationId"
$lexiUrl = "$safeLexiBase/webhook/customer-context"

Write-Host "" 
Write-Host "1) Tester Madkontrol endpoint" -ForegroundColor Cyan
Write-Host "$madkontrolUrl"

$madkontrolResponse = Invoke-JsonGet -Url $madkontrolUrl -Headers $headers

if (-not $madkontrolResponse.ok) {
  throw "Madkontrol endpoint returnerede ok=false"
}

Write-Host "Madkontrol ok=true" -ForegroundColor Green
Write-Host ("Status: {0}" -f $madkontrolResponse.status)
Write-Host ("Operating mode: {0}" -f $madkontrolResponse.operatingMode)
Write-Host ("Rutiner aktive: {0} | Due i dag: {1}" -f $madkontrolResponse.antal_rutiner, $madkontrolResponse.antal_forfaldne_rutiner)

Write-Host ""
Write-Host "2) Tester LexiVoice proxy endpoint" -ForegroundColor Cyan
Write-Host "$lexiUrl"

$lexiPayload = @{
  companyId = $CompanyId
  locationId = $LocationId
}

$lexiResponse = Invoke-JsonPost -Url $lexiUrl -Headers @{} -Body $lexiPayload

if (-not $lexiResponse.ok) {
  throw "LexiVoice endpoint returnerede ok=false"
}

Write-Host "LexiVoice ok=true" -ForegroundColor Green
Write-Host ("Status: {0}" -f $lexiResponse.status)
Write-Host ("Operating mode: {0}" -f $lexiResponse.operatingMode)
Write-Host ("Rutiner aktive: {0} | Due i dag: {1}" -f $lexiResponse.antal_rutiner, $lexiResponse.antal_forfaldne_rutiner)

Write-Host ""
Write-Host "Smoke-test gennemfoert uden fejl." -ForegroundColor Green
