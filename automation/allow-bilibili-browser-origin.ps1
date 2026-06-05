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
$seedPath = Join-Path $sessionsDir "bilibili-creator-center.toml"

function Write-SessionLines {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string[]]$Lines
    )

    for ($attempt = 1; $attempt -le 3; $attempt++) {
        try {
            Set-Content -LiteralPath $Path -Value $Lines -Encoding UTF8
            return $true
        } catch [System.UnauthorizedAccessException] {
            if ($attempt -eq 3) {
                Write-Warning "Could not update browser session because access was denied: $Path"
                return $false
            }
            Start-Sleep -Milliseconds (250 * $attempt)
        } catch [System.IO.IOException] {
            if ($attempt -eq 3) {
                Write-Warning "Could not update browser session because it appears to be locked: $Path"
                return $false
            }
            Start-Sleep -Milliseconds (250 * $attempt)
        }
    }
}

if (-not (Test-Path -LiteralPath $sessionsDir)) {
    New-Item -ItemType Directory -Path $sessionsDir | Out-Null
}

@"
[origins]
$allowedLine
"@ | Set-Content -LiteralPath $seedPath -Encoding UTF8

$sessionFiles = Get-ChildItem -Path $sessionsDir -Filter "*.toml" -File -ErrorAction SilentlyContinue

foreach ($file in $sessionFiles) {
    $lines = Get-Content -LiteralPath $file.FullName
    if ($lines -contains $deniedLine) {
        $lines = $lines | ForEach-Object {
            if ($_ -eq $deniedLine) { $allowedLine } else { $_ }
        }
        if (Write-SessionLines -Path $file.FullName -Lines $lines) {
            Write-Host "Allowed Bilibili origin in session: $($file.Name)"
        }
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
    @"
[origins]
$allowedLine
"@ | Set-Content -LiteralPath $seedPath -Encoding UTF8
    Write-Host "Created Bilibili origin allow file: $seedPath"
}

Write-Host "Bilibili browser origin permission preflight completed."
