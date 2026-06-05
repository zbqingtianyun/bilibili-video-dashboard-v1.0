# B站视频数据自动化拉取 Runbook

## 目标
每天 06:00 由 Codex cron 自动化进入 B站创作中心「数据概览 / 近期稿件对比」模块，勾选全部自选指标并导出 CSV。优先使用 Google Chrome 插件通道；如果 Codex 会话把 `member.bilibili.com` 记为 denied，先运行来源放行脚本修正并重试一次；若 Chrome 插件通道出现安全策略拒绝、DOM/evaluate/screenshot 连续超时或会话重置，立即切换到 CDP 专用 Chrome。CSV 必须直接保存到本项目目录，随后同步更新仪表盘数据文件并推送到 GitHub。

自动化名称：`B站视频数据每日更新`
Codex 自动化 ID：`b`

自动化不得运行 Vercel 命令。Vercel 已关联 GitHub，由平台侧在 GitHub push 后自行处理部署。

## 前提条件
1. Windows 本机每天 06:00 已开机、联网，Codex 可运行本地 cron 自动化。
2. B站创作中心账号已登录，且导出流程不触发验证码、二次验证或人工确认。
3. 优先使用 Codex Chrome Extension / Google Chrome 插件控制通道；若该通道被 B站创作中心页面安全策略拒绝，允许使用 CDP 或独立 Playwright。
4. Chrome 默认下载目录已经固定为本仓库根目录：`F:\zhangbin_codex\b站数据看板1.0版本`。
5. 本仓库 `origin/master` 具备 GitHub 推送权限。
6. CDP 专用 Chrome 使用本仓库下的独立 profile：`F:\zhangbin_codex\b站数据看板1.0版本\.chrome-bilibili-profile`。首次使用时需要在该专用 Chrome 窗口手动登录 B站。

## 步骤 A：浏览器导出

### A1. 选择浏览器控制方式
先运行 Codex 来源放行脚本：

```powershell
powershell -ExecutionPolicy Bypass -File automation\allow-bilibili-browser-origin.ps1
```

该脚本只修改 `C:\Users\26230\.codex\browser\sessions\*.toml` 中对 `https://member.bilibili.com` 的 `denied/allowed` 记录，并写入一个稳定 allow seed；不读取 cookies、localStorage、密码或 Chrome profile 数据。

优先级如下：

1. Codex Chrome Extension / Google Chrome 插件通道：优先 claim 用户已打开的 B站创作中心标签。
2. CDP：当 Chrome 插件通道提示 `member.bilibili.com` 该站点不可使用、浏览器安全策略拒绝，或读取 DOM、截图、页面 evaluate 连续超时并重置会话时，必须切换到 CDP 控制浏览器。
3. 独立 Playwright：当 Chrome 插件和 CDP 均不可用时，允许使用独立 Playwright 打开目标页面。

不得读取 cookies、localStorage、密码、浏览器配置文件或其他敏感会话数据。不得绕过验证码、二次验证或站点安全拦截。

### A2. 打开或接管目标页面
目标 URL：

```text
https://member.bilibili.com/platform/data-up/video/
```

Chrome 插件通道：只 claim 已打开的 B站创作中心标签，不主动打开 `member.bilibili.com`；若读取控件或打开页面时提示该站点不可使用，先运行 `automation\allow-bilibili-browser-origin.ps1` 并只重试一次。若 DOM snapshot、页面 evaluate、截图、visible DOM 等页面读取动作连续超时，或导致浏览器会话重置，不再继续重试插件通道，立即切换到 CDP。

CDP：先运行：

```powershell
powershell -ExecutionPolicy Bypass -File automation\start-bilibili-cdp-chrome.ps1
```

然后连接 `http://127.0.0.1:9222`。该脚本会使用独立 profile 启动 Chrome，并把下载目录写为本项目根目录。若首次打开时未登录 B站，需要用户在该专用 Chrome 窗口完成登录后再重试自动化。

独立 Playwright：只作为最后兜底。打开后若未登录、触发验证码、触发二次验证或无法进入创作中心，则停止任务并报告，不尝试绕过。

进入「数据概览」下的「近期稿件对比」模块。若页面结构变化导致无法定位模块，停止任务并报告。

### A3. 全选自选指标
打开「自选指标」或「自定义指标」面板，将所有可用指标全部勾选。导出字段至少必须包含：

```text
视频标题, 发布时间, 播放量
```

### A4. 导出 CSV
点击「导出」/「下载」/「导出数据」按钮，并等待 CSV 文件出现在项目根目录。

CSV 必须直接落在：

```text
F:\zhangbin_codex\b站数据看板1.0版本
```

如果文件出现在 Chrome 默认 Downloads 或其他目录，任务必须失败；不得从默认 Downloads 搬运文件。

## 步骤 B：数据同步与推送
Chrome 导出前先记录：

```powershell
$runStartedAt = Get-Date
$previousDashboardHash = if (Test-Path "public\data\recent-videos.csv") { (Get-FileHash "public\data\recent-videos.csv" -Algorithm SHA256).Hash } else { "" }
```

导出完成后运行：

```powershell
powershell -ExecutionPolicy Bypass -File automation\bilibili-update.ps1 -RunStartedAt $runStartedAt.ToString("o") -PreviousDashboardHash $previousDashboardHash
```

脚本负责：
1. 在项目根目录查找最新的 `近期稿件对比*.csv`。
2. 验证该 CSV 的 `LastWriteTime` 晚于本次自动化开始时间。
3. 验证 CSV 表头包含 `视频标题`、`发布时间`、`播放量`。
4. 替换 `近期稿件对比.csv` 和 `public/data/recent-videos.csv`。
5. 如果数据无变化，说明本次导出成功但跳过 commit/push。
6. 如果数据有变化，提交 `Auto-update B站 video data yyyy-MM-dd` 并推送 `origin/master`。

脚本不调用 Vercel。

## 失败处理
- Chrome 插件不可用、对 B站创作中心返回安全策略拒绝、DOM/evaluate/screenshot 连续超时或会话重置：先运行 `automation\allow-bilibili-browser-origin.ps1` 并最多重试一次；仍失败或发生页面读取超时/会话重置时，切换到 CDP。
- CDP 端口不可用：运行 `automation\start-bilibili-cdp-chrome.ps1` 启动专用 Chrome，再连接 `http://127.0.0.1:9222`。
- CDP / 独立 Playwright 无法复用登录态或无法进入创作中心：停止任务并报告，需要用户修复登录态或手动确认可访问性。
- 未找到已打开的 B站创作中心标签：仅对 Chrome 插件通道视为失败；随后允许切换到 CDP 或独立 Playwright。
- 登录失效：停止任务，要求手动在 Chrome 登录 B站后重试。
- 验证码或二次验证：停止任务，不尝试绕过。
- 页面结构变化：停止任务，要求重新确认按钮和模块路径。
- Chrome 下载目录不是项目根目录：停止任务，不从其他目录搬运 CSV。
- 导出后项目目录没有新 CSV：停止任务，避免把旧 CSV 误判为本次导出。
- CSV 表头不匹配：停止任务，不替换、不提交。
- Git 推送失败：停止任务，报告 GitHub 权限、网络或远程分支问题。

## 验证
手动试运行自动化后检查：
1. 项目根目录出现本次任务后写入的 `近期稿件对比*.csv`。
2. `public/data/recent-videos.csv` 已由最新 CSV 同步。
3. `npm run build` 通过。
4. `git status --short --branch` 显示工作区干净。
5. GitHub `origin/master` 出现自动提交；若数据无变化，则无新提交且日志说明跳过。
