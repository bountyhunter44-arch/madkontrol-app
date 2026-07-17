# Downloads one source zip per DISTINCT deploy (same deploy = same md5 = same tree).
# Read-only against GCS. No deletes, no uploads.
# ASCII only: PowerShell 5.1 reads .ps1 as ANSI.
param(
  [string]$Inventory,
  [string]$OutDir,
  [string]$Project = "madkontrollen"
)

$env:CLOUDSDK_PYTHON = "C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\platform\bundledpython\python.exe"

$inv = Get-Content $Inventory -Raw | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$grupper = $inv | Group-Object { ([datetime]'1970-01-01').AddMilliseconds([double]$_.generation / 1000).ToString('yyyy-MM-ddTHH-mm') }

Write-Output "Distinct deploys: $($grupper.Count)"
Write-Output ""

$seen = @{}
foreach ($g in ($grupper | Sort-Object Name)) {
  $rep = $g.Group[0]
  $uri = "gs://$($rep.bucket)/$($rep.object)"

  $md5 = (& gcloud storage objects describe $uri --project $Project --format="value(md5_hash)" 2>$null)
  if (-not $md5) {
    Write-Output ("  SKIP {0} - could not read md5" -f $g.Name)
    continue
  }

  if ($seen.ContainsKey($md5)) {
    Write-Output ("  =    {0}  {1,3} fn  same tree as {2}" -f $g.Name, $g.Count, $seen[$md5])
    continue
  }
  $seen[$md5] = $g.Name

  $dest = Join-Path $OutDir "$($g.Name).zip"
  & gcloud storage cp $uri $dest --project $Project 2>$null | Out-Null
  if (Test-Path $dest) {
    $mb = [math]::Round((Get-Item $dest).Length / 1MB, 1)
    Write-Output ("  +    {0}  {1,3} fn  {2,6} MB  (repr: {3})" -f $g.Name, $g.Count, $mb, $rep.id)
  } else {
    Write-Output ("  FAIL {0} - download failed" -f $g.Name)
  }
}

Write-Output ""
Write-Output "Distinct source trees downloaded: $($seen.Count)"
