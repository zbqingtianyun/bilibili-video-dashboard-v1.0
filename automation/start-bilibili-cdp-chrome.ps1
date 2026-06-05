<#
.SYNOPSIS
    Start a dedicated Chrome instance for Bilibili automation over CDP.
.DESCRIPTION
    Uses a dedicated Chrome user-data-dir and a local-only remote debugging
    port. The profile is separate from the user's daily Chrome profile. The
    first run requires manual Bilibili login in the opened Chrome window.
#>

param(
    [int]$Port = 9222,
    [string]$ProjectRoot = "F:\zhangbin_codex\b站数据看板1.0版本",
    [string]$ProfileDir = "F:\zhangbin_codex\b站数据看板1.0版本\.chrome-bilibili-profile",
    [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"

function Find-ChromeExe {
    $candidates = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    )

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path -LiteralPath $candidate)) {
            return $candidate
        }
    }

    $cmd = Get-Command chrome.exe -ErrorAction SilentlyContinue
    if ($cmd) {
        return $cmd.Source
    }

    throw "未找到 chrome.exe"
}

function Test-CdpPort {
    param([int]$PortToCheck)

    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$PortToCheck/json/version" -TimeoutSec 2
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

function Get-CdpOwnerProcess {
    param([int]$PortToCheck)

    $connection = Get-NetTCPConnection -LocalPort $PortToCheck -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if (-not $connection) {
        return $null
    }

    return Get-CimInstance Win32_Process -Filter "ProcessId = $($connection.OwningProcess)" -ErrorAction SilentlyContinue
}

function Stop-DedicatedChrome {
    param([string]$ProfileRoot)

    $processes = Get-CimInstance Win32_Process -Filter "name = 'chrome.exe'" -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -like "*$ProfileRoot*" }

    foreach ($process in $processes) {
        Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

function Test-DownloadProtectionFlags {
    param([string]$CommandLine)

    return (
        $CommandLine -like "*--safebrowsing-disable-download-protection*" -and
        $CommandLine -like "*--disable-client-side-phishing-detection*" -and
        $CommandLine -like "*--disable-features=DownloadBubble,DownloadBubbleV2*"
    )
}

function Ensure-DownloadPreferences {
    param(
        [string]$ProfileRoot,
        [string]$DownloadDir
    )

    $defaultDir = Join-Path $ProfileRoot "Default"
    $preferencesPath = Join-Path $defaultDir "Preferences"

    if (-not (Test-Path -LiteralPath $defaultDir)) {
        New-Item -ItemType Directory -Path $defaultDir | Out-Null
    }

    $preferences = @{}
    if (Test-Path -LiteralPath $preferencesPath) {
        try {
            $raw = Get-Content -LiteralPath $preferencesPath -Raw -ErrorAction Stop
            if ($raw.Trim()) {
                $preferences = ConvertFrom-Json $raw -ErrorAction Stop
            }
        } catch {
            $preferences = @{}
        }
    }

    $preferencesJson = @{
        download = @{
            default_directory = $DownloadDir
            prompt_for_download = $false
            directory_upgrade = $true
            restrictions = 0
        }
        safebrowsing = @{
            enabled = $false
            disable_download_protection = $true
        }
    }

    if ($preferences -and $preferences.PSObject.Properties.Count -gt 0) {
        $preferences | Add-Member -NotePropertyName download -NotePropertyValue $preferencesJson.download -Force
        $preferences | Add-Member -NotePropertyName safebrowsing -NotePropertyValue $preferencesJson.safebrowsing -Force
        $preferencesJson = $preferences
    }

    $preferencesJson | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $preferencesPath -Encoding UTF8
}

if (-not (Test-Path -LiteralPath $ProjectRoot)) {
    throw "项目目录不存在：$ProjectRoot"
}

if (-not (Test-Path -LiteralPath $ProfileDir)) {
    New-Item -ItemType Directory -Path $ProfileDir | Out-Null
}

Ensure-DownloadPreferences -ProfileRoot $ProfileDir -DownloadDir $ProjectRoot

if (Test-CdpPort -PortToCheck $Port) {
    $owner = Get-CdpOwnerProcess -PortToCheck $Port
    if ($owner -and $owner.CommandLine -like "*$ProfileDir*") {
        if (Test-DownloadProtectionFlags -CommandLine $owner.CommandLine) {
            Write-Host "CDP 已可用且下载保护参数已生效: http://127.0.0.1:$Port"
            exit 0
        }

        if ($CheckOnly) {
            Write-Host "CDP 可用但下载保护参数未生效，需要重启专用 Chrome: http://127.0.0.1:$Port"
            exit 1
        }

        Write-Host "CDP 已运行但下载保护参数未生效，正在重启专用 Chrome。"
        Stop-DedicatedChrome -ProfileRoot $ProfileDir
        Start-Sleep -Seconds 2
    } elseif ($owner) {
        throw "端口 $Port 已被非 B站专用 Chrome 占用，进程 $($owner.ProcessId)。"
    }
}

if ($CheckOnly) {
    Write-Host "CDP 不可用: http://127.0.0.1:$Port"
    exit 1
}

$chromeExe = Find-ChromeExe
$args = @(
    "--remote-debugging-port=$Port",
    "--remote-debugging-address=127.0.0.1",
    "--user-data-dir=$ProfileDir",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-popup-blocking",
    "--safebrowsing-disable-download-protection",
    "--disable-client-side-phishing-detection",
    "--disable-features=DownloadBubble,DownloadBubbleV2",
    "https://member.bilibili.com/platform/data-up/video/"
)

Start-Process -FilePath $chromeExe -ArgumentList $args -WindowStyle Hidden | Out-Null

$deadline = (Get-Date).AddSeconds(25)
while ((Get-Date) -lt $deadline) {
    if (Test-CdpPort -PortToCheck $Port) {
        Write-Host "CDP 已启动: http://127.0.0.1:$Port"
        Write-Host "Profile: $ProfileDir"
        Write-Host "Download directory: $ProjectRoot"
        exit 0
    }
    Start-Sleep -Milliseconds 500
}

throw "Chrome 已启动但 CDP 端口未在 25 秒内可用：http://127.0.0.1:$Port"

