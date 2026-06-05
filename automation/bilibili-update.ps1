<#
.SYNOPSIS
    B站视频数据仪表盘 - 数据更新与推送脚本
.DESCRIPTION
    从项目目录或 Chrome 下载目录找到最新的「近期稿件对比」CSV，
    验证表头后替换项目根目录的原始 CSV 和 public/data/recent-videos.csv。
    只有数据发生变化时才提交并推送到 GitHub。
.NOTES
    配合 automation/runbook.md 使用。
    步骤 A（Chrome 导出）需人工或 Codex Chrome 扩展完成。
    本脚本负责步骤 B（文件替换 + Git 推送）。
#>

$ErrorActionPreference = "Stop"

$projectRoot = "F:\zhangbin_codex\b站数据看板1.0版本"
$sourceTarget = "近期稿件对比.csv"
$dashboardTarget = "public\data\recent-videos.csv"
$expectedHeaderParts = @("视频标题", "发布时间", "播放量")

function Fail($message) {
    Write-Error $message
    exit 1
}

Set-Location $projectRoot

if (-not (Test-Path -LiteralPath ".git")) {
    Fail "当前目录不是 Git 仓库：$projectRoot"
}

# 1. 找到最新的 B站 近期稿件 CSV。优先支持 Chrome 直接保存到项目目录，也兼容默认下载目录。
$downloads = Join-Path ([Environment]::GetFolderPath('UserProfile')) 'Downloads'
$projectCsvs = Get-ChildItem -Path $projectRoot -Filter '近期稿件对比*.csv' -ErrorAction SilentlyContinue
$downloadCsvs = Get-ChildItem -Path $downloads -Filter '近期稿件对比*.csv' -ErrorAction SilentlyContinue
$latest = @($projectCsvs + $downloadCsvs) `
  | Sort-Object LastWriteTime -Descending `
  | Select-Object -First 1

if (-not $latest) {
    Fail "未在项目目录或下载目录找到「近期稿件对比」CSV 文件，请先完成 Chrome 导出步骤。"
}

Write-Host "找到 CSV: $($latest.FullName) (最后写入: $($latest.LastWriteTime))"

# 2. 验证 CSV 表头
$header = Get-Content -LiteralPath $latest.FullName -TotalCount 1 -Encoding UTF8
foreach ($part in $expectedHeaderParts) {
    if ($header -notlike "*$part*") {
        Fail "CSV 表头缺少字段「$part」，跳过替换。表头: $header"
    }
}

Write-Host "CSV 表头验证通过。"

# 3. 替换项目 CSV 和仪表盘数据文件；无变化时跳过提交和推送
$dashboardTargetExists = Test-Path -LiteralPath $dashboardTarget
if ($dashboardTargetExists) {
    $sourceHash = (Get-FileHash -LiteralPath $latest.FullName -Algorithm SHA256).Hash
    $dashboardHash = (Get-FileHash -LiteralPath $dashboardTarget -Algorithm SHA256).Hash
    if ($sourceHash -eq $dashboardHash) {
        $sourceTargetPath = if (Test-Path -LiteralPath $sourceTarget) { (Resolve-Path -LiteralPath $sourceTarget).Path } else { $null }
        if ((Resolve-Path -LiteralPath $latest.FullName).Path -ne $sourceTargetPath) {
            Copy-Item -LiteralPath $latest.FullName -Destination $sourceTarget -Force
            Write-Host "已同步项目根目录 CSV: $sourceTarget"
        }
        Write-Host "CSV 与当前仪表盘数据一致，跳过提交和推送。"
        exit 0
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
git add $sourceTarget $dashboardTarget
git diff --cached --quiet -- $sourceTarget $dashboardTarget
if ($LASTEXITCODE -eq 0) {
    Write-Host "Git 暂存区无数据变化，跳过提交和推送。"
    exit 0
}

$dateStr = Get-Date -Format 'yyyy-MM-dd'
$commitMsg = "Auto-update B站 video data $dateStr"

git commit -m $commitMsg
if ($LASTEXITCODE -ne 0) {
    Fail "Git commit 失败。"
}

git push origin master
if ($LASTEXITCODE -ne 0) {
    Fail "Git push 失败。"
}

Write-Host "推送完成: $commitMsg"
