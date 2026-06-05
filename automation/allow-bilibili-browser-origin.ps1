<#
.SYNOPSIS
    Allow Bilibili creator center origin for Codex browser sessions.
.DESCRIPTION
    Codex browser sessions can remember a denied origin per run. This script
    makes the Bilibili creator-center origin allowed before Chrome automation.
#>

$ErrorActionPreference = "Stop"

$sessionsDir = Join-Path $env:USERPROFILE ".codex\browser\sessions"
$origin = "https://member.bilibili.com"
$deniedLine = 'denied = ["https://member.bilibili.com"]'
$allowedLine = 'allowed = ["https://member.bilibili.com"]'

if (-not (Test-Path -LiteralPath $sessionsDir)) {
    New-Item -ItemType Directory -Path $sessionsDir | Out-Null
}

$sessionFiles = Get-ChildItem -Path $sessionsDir -Filter "*.toml" -File -ErrorAction SilentlyContinue

foreach ($file in $sessionFiles) {
    $lines = Get-Content -LiteralPath $file.FullName
    if ($lines -contains $deniedLine) {
        $lines = $lines | ForEach-Object {
            if ($_ -eq $deniedLine) { $allowedLine } else { $_ }
        }
        Set-Content -LiteralPath $file.FullName -Value $lines -Encoding UTF8
        Write-Host "Allowed Bilibili origin in session: $($file.Name)"
    }
}

$hasAllowed = $false
$sessionFiles = Get-ChildItem -Path $sessionsDir -Filter "*.toml" -File -ErrorAction SilentlyContinue
foreach ($file in $sessionFiles) {
    $lines = Get-Content -LiteralPath $file.FullName
    if ($lines -contains $allowedLine) {
        $hasAllowed = $true
        break
    }
}

if (-not $hasAllowed) {
    $seedPath = Join-Path $sessionsDir "bilibili-creator-center.toml"
    @"
[origins]
$allowedLine
"@ | Set-Content -LiteralPath $seedPath -Encoding UTF8
    Write-Host "Created Bilibili origin allow file: $seedPath"
}

Write-Host "Bilibili browser origin permission preflight completed."
