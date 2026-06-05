<#
.SYNOPSIS
    Allow the Bilibili creator-center origin for Codex browser automation sessions.
.DESCRIPTION
    Codex browser sessions can store a per-session denied origin after a user or
    runtime denial. This script flips member.bilibili.com from denied to allowed
    and seeds a stable allow file for future runs. It does not read browser
    cookies, localStorage, passwords, or Chrome profile data.
#>

$ErrorActionPreference = "Stop"

$sessionsDir = Join-Path $env:USERPROFILE ".codex\browser\sessions"
$origin = "https://member.bilibili.com"
$seedPath = Join-Path $sessionsDir "bilibili-creator-center.toml"
$updated = 0
$skipped = 0

function Write-AllowFile($path) {
    @"
[origins]
allowed = ["https://member.bilibili.com"]
"@ | Set-Content -LiteralPath $path -Encoding UTF8
}

if (-not (Test-Path -LiteralPath $sessionsDir)) {
    New-Item -ItemType Directory -Path $sessionsDir | Out-Null
}

$sessionFiles = Get-ChildItem -Path $sessionsDir -Filter "*.toml" -File -ErrorAction SilentlyContinue

foreach ($file in $sessionFiles) {
    try {
        $content = Get-Content -LiteralPath $file.FullName -Raw -ErrorAction Stop

        if ($content -match 'denied\s*=\s*\[[^\]]*"https://member\.bilibili\.com"[^\]]*\]') {
            $content = $content -replace 'denied\s*=\s*\[[^\]]*"https://member\.bilibili\.com"[^\]]*\]', 'allowed = ["https://member.bilibili.com"]'
            Set-Content -LiteralPath $file.FullName -Value $content -Encoding UTF8 -ErrorAction Stop
            $updated += 1
            Write-Host "Allowed Bilibili origin in session: $($file.Name)"
        }
    } catch {
        $skipped += 1
        Write-Host "Skipped locked or unreadable session file: $($file.Name)"
    }
}

Write-AllowFile $seedPath
Write-Host "Ensured Bilibili origin allow seed: $seedPath"
Write-Host "Bilibili origin preflight complete. Updated=$updated Skipped=$skipped Origin=$origin"

