$src = "d:\madkontrol-app\public\modules\egenkontrol\egenkontrolDefinitions.js"
$dst = "d:\madkontrol-app\functions\shared\egenkontrolDefinitions.js"

Copy-Item -Path $src -Destination $dst -Force
Write-Host "✅ egenkontrolDefinitions.js synkroniseret til functions/shared"
