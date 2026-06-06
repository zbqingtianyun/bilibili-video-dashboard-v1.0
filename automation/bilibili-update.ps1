<#
.SYNOPSIS
    B站视频数据仪表盘 - 数据更新与推送脚本
.DESCRIPTION
    从项目目录找到最新的「近期稿件对比」CSV，
    验证表头后替换项目根目录的原始 CSV 和 public/data/recent-videos.csv。
    只有数据发生变化时才提交并推送到 GitHub。
.NOTES
    配合 automation/runbook.md 使用。
    步骤 A（Chrome 导出）需人工或 Codex Chrome 扩展完成。
    本脚本负责步骤 B（文件替换 + Git 推送）。
#>

param(
    [string]$RunStartedAt,
    [string]$PreviousDashboardHash
)

$ErrorActionPreference = "Stop"

$projectRoot = "F:\zhangbin_codex\b站数据看板1.0版本"
$sourceTarget = "近期稿件对比.csv"
$dashboardTarget = "public\data\recent-videos.csv"
$expectedHeaderParts = @("视频标题", "发布时间", "播放量")

function Fail($message) {
    Write-Error $message
    exit 1
}

function Get-GitProcesses {
    return Get-CimInstance Win32_Process -Filter "name = 'git.exe'" -ErrorAction SilentlyContinue
}

function Test-GitWriteAccess {
    $objectProbe = Join-Path (Resolve-Path -LiteralPath ".git\objects").Path "codex-write-probe.tmp"
    $indexProbe = Join-Path (Resolve-Path -LiteralPath ".git").Path "index.lock"

    try {
        Set-Content -LiteralPath $objectProbe -Value "probe" -Encoding ASCII -ErrorAction Stop
        Remove-Item -LiteralPath $objectProbe -Force -ErrorAction Stop
    } catch {
        Fail ".git\objects 不可写，Git 无法创建对象：$($_.Exception.Message)"
    }

    if (Test-Path -LiteralPath $indexProbe) {
        $lock = Get-Item -LiteralPath $indexProbe
        $gitProcesses = @(Get-GitProcesses)
        $lockAgeSeconds = ((Get-Date) - $lock.LastWriteTime).TotalSeconds

        if ($gitProcesses.Count -eq 0 -and $lockAgeSeconds -gt 120) {
            Remove-Item -LiteralPath $indexProbe -Force -ErrorAction Stop
            Write-Host "已清理陈旧 Git index.lock。"
        } else {
            Fail "Git index.lock 正在被占用或刚刚创建，请稍后重试。Git 进程数: $($gitProcesses.Count)，锁文件年龄: $([math]::Round($lockAgeSeconds, 1)) 秒。"
        }
    }

    try {
        New-Item -ItemType File -Path $indexProbe -ErrorAction Stop | Out-Null
        Remove-Item -LiteralPath $indexProbe -Force -ErrorAction Stop
    } catch {
        Fail "无法创建 .git\index.lock，Git 暂存区不可写：$($_.Exception.Message)"
    }
}

function Invoke-GitWithRetry {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,
        [int]$MaxAttempts = 3
    )

    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        & git @Arguments
        if ($LASTEXITCODE -eq 0) {
            return
        }

        if ($attempt -lt $MaxAttempts) {
            Write-Host "Git 命令失败，准备重试 ${attempt}/${MaxAttempts}: git $($Arguments -join ' ')"
            Start-Sleep -Seconds (2 * $attempt)
            Test-GitWriteAccess
        }
    }

    Fail "Git 命令失败: git $($Arguments -join ' ')"
}

Set-Location $projectRoot

if (-not (Test-Path -LiteralPath ".git")) {
    Fail "当前目录不是 Git 仓库：$projectRoot"
}

if ($RunStartedAt) {
    try {
        $runStartedAtDate = [DateTime]::Parse($RunStartedAt)
    } catch {
        Fail "RunStartedAt 参数不是有效时间：$RunStartedAt"
    }
    Write-Host "本次自动化开始时间: $($runStartedAtDate.ToString('o'))"
}

if ($PreviousDashboardHash) {
    Write-Host "旧仪表盘 CSV SHA256: $PreviousDashboardHash"
}

# 1. 找到项目目录中最新的 B站 近期稿件 CSV。Chrome 下载目录就是项目目录。
$projectCsvs = Get-ChildItem -Path $projectRoot -Filter '近期稿件对比*.csv' -ErrorAction SilentlyContinue
$latest = @($projectCsvs) `
  | Sort-Object LastWriteTime -Descending `
  | Select-Object -First 1

if (-not $latest) {
    Fail "未在项目目录找到「近期稿件对比」CSV 文件，请先完成 Chrome 导出步骤。"
}

Write-Host "找到 CSV: $($latest.FullName) (最后写入: $($latest.LastWriteTime))"

if ($RunStartedAt -and $latest.LastWriteTime -lt $runStartedAtDate) {
    Fail "导出未完成：项目目录中最新 CSV 早于本次自动化开始时间。请确认 Chrome 下载目录固定为项目根目录，且导出动作成功。"
}

# 2. 验证 CSV 表头
$header = Get-Content -LiteralPath $latest.FullName -TotalCount 1 -Encoding UTF8
foreach ($part in $expectedHeaderParts) {
    if ($header -notlike "*$part*") {
        Fail "CSV 表头缺少字段「$part」，跳过替换。表头: $header"
    }
}

Write-Host "CSV 表头验证通过。"

# 3. 替换项目 CSV 和仪表盘数据文件；无变化时跳过提交和推送
$sourceHash = (Get-FileHash -LiteralPath $latest.FullName -Algorithm SHA256).Hash
$dashboardTargetExists = Test-Path -LiteralPath $dashboardTarget
if ($dashboardTargetExists) {
    $dashboardHash = (Get-FileHash -LiteralPath $dashboardTarget -Algorithm SHA256).Hash
    if ($sourceHash -eq $dashboardHash) {
        $sourceTargetPath = if (Test-Path -LiteralPath $sourceTarget) { (Resolve-Path -LiteralPath $sourceTarget).Path } else { $null }
        if ((Resolve-Path -LiteralPath $latest.FullName).Path -ne $sourceTargetPath) {
            Copy-Item -LiteralPath $latest.FullName -Destination $sourceTarget -Force
            Write-Host "已同步项目根目录 CSV: $sourceTarget"
        }

        git diff --quiet -- $sourceTarget $dashboardTarget
        if ($LASTEXITCODE -eq 0) {
            Write-Host "本次导出 CSV 与当前仪表盘数据一致，且工作区无数据差异，跳过提交和推送。"
            exit 0
        }

        Write-Host "数据文件内容已同步，但存在未提交的数据差异，继续提交和推送。"
    }
}

$sourceTargetPath = if (Test-Path -LiteralPath $sourceTarget) { (Resolve-Path -LiteralPath $sourceTarget).Path } else { $null }
if ((Resolve-Path -LiteralPath $latest.FullName).Path -ne $sourceTargetPath) {
    Copy-Item -LiteralPath $latest.FullName -Destination $sourceTarget -Force
}
Copy-Item -LiteralPath $latest.FullName -Destination $dashboardTarget -Force
Write-Host "已替换 $sourceTarget"
Write-Host "已替换 $dashboardTarget"

# 4. Git 提交和推送；本脚本不调用 Vercel
Test-GitWriteAccess
Invoke-GitWithRetry -Arguments @("add", $sourceTarget, $dashboardTarget)
git diff --cached --quiet -- $sourceTarget $dashboardTarget
if ($LASTEXITCODE -eq 0) {
    Write-Host "Git 暂存区无数据变化，跳过提交和推送。"
    exit 0
}

$dateStr = Get-Date -Format 'yyyy-MM-dd'
$commitMsg = "Auto-update B站 video data $dateStr"

Invoke-GitWithRetry -Arguments @("commit", "-m", $commitMsg)
Invoke-GitWithRetry -Arguments @("push", "origin", "master")

Write-Host "推送完成: $commitMsg"

