# SLET FRA HER

$source = "D:\madkontrol-app\public\modules\egenkontrol\egenkontrolDefinitions.js"
$destination = "D:\madkontrol-app\functions\shared\egenkontrolDefinitions.js"

if (!(Test-Path $source)) {
    Write-Host "❌ Source fil findes ikke:" $source
    exit 1
}

$destFolder = Split-Path $destination
if (!(Test-Path $destFolder)) {
    Write-Host "📁 Opretter mappe:" $destFolder
    New-Item -ItemType Directory -Path $destFolder | Out-Null
}

function Sync-Definitions {
    try {
        Copy-Item $source $destination -Force
        $time = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Write-Host "✅ [$time] Synced egenkontrolDefinitions.js"
    }
    catch {
        Write-Host "❌ Sync fejl:" $_.Exception.Message
    }
}

# Første sync ved opstart
Sync-Definitions

$folder = Split-Path $source
$fileName = Split-Path $source -Leaf

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $folder
$watcher.Filter = $fileName
$watcher.IncludeSubdirectories = $false
$watcher.EnableRaisingEvents = $true
$watcher.NotifyFilter = [System.IO.NotifyFilters]'FileName, LastWrite, Size'

Write-Host ""
Write-Host "👀 Watch mode aktiv"
Write-Host "Source:      $source"
Write-Host "Destination: $destination"
Write-Host "Tryk Ctrl+C for at stoppe"
Write-Host ""

$action = {
    Start-Sleep -Milliseconds 200
    try {
        Copy-Item $using:source $using:destination -Force
        $time = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        Write-Host "✅ [$time] Auto-synced efter ændring"
    }
    catch {
        Write-Host "❌ Auto-sync fejl:" $_.Exception.Message
    }
}

$changedRegistration = Register-ObjectEvent $watcher Changed -Action $action
$createdRegistration = Register-ObjectEvent $watcher Created -Action $action
$renamedRegistration = Register-ObjectEvent $watcher Renamed -Action $action

try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
}
finally {
    Unregister-Event -SourceIdentifier $changedRegistration.Name -ErrorAction SilentlyContinue
    Unregister-Event -SourceIdentifier $createdRegistration.Name -ErrorAction SilentlyContinue
    Unregister-Event -SourceIdentifier $renamedRegistration.Name -ErrorAction SilentlyContinue
    $watcher.Dispose()
}

# TIL HER