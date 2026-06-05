# B站视频数据自动化拉取 Runbook

## 目标
每天 06:00 由 Codex cron 自动化通过 Google Chrome 插件通道 claim 用户已打开的 B站创作中心标签，进入「数据概览 / 近期稿件对比」模块，勾选全部自选指标并导出 CSV。CSV 必须直接保存到本项目目录，随后同步更新仪表盘数据文件并推送到 GitHub。

自动化名称：`B站视频数据每日更新`
Codex 自动化 ID：`b`

自动化不得运行 Vercel 命令。Vercel 已关联 GitHub，由平台侧在 GitHub push 后自行处理部署。

## 前提条件
1. Windows 本机每天 06:00 已开机、联网，Codex 可运行本地 cron 自动化。
2. Chrome 已登录 B站创作中心账号，且导出流程不触发验证码、二次验证或人工确认。
3. Codex Chrome Extension / Google Chrome 插件控制通道可用。
4. Chrome 默认下载目录已经固定为本仓库根目录：`F:\zhangbin_codex\b站数据看板1.0版本`。
5. 本仓库 `origin/master` 具备 GitHub 推送权限。
6. 每天任务运行前，Chrome 中必须已经打开 B站创作中心标签，URL 应为 `https://member.bilibili.com/platform/data-up/video/` 或同域 `member.bilibili.com` 创作中心页面。

## 步骤 A：Chrome 插件导出

### A1. 连接 Chrome 扩展
必须使用 Codex Chrome Extension / Google Chrome 插件通道连接用户 Chrome。若连接失败，停止任务并报告失败原因。

不得改用 Codex in-app Browser、独立 Playwright 浏览器、CDP 临时浏览器或无登录态的新浏览器环境。不得读取 cookies、localStorage、密码、浏览器配置文件或其他敏感会话数据。

### A2. Claim 已打开的目标页面
只允许 claim 已打开的 B站创作中心标签，匹配 URL：

```text
https://member.bilibili.com/platform/data-up/video/
https://member.bilibili.com/
```

不得由自动化主动打开或导航到 `member.bilibili.com`。当前 Chrome 插件通道直接打开该站点会被浏览器安全策略拦截，提示“该站点不可使用”。如果没有找到已打开的 B站创作中心标签，任务必须停止，并报告：请用户先手动在 Chrome 打开 `https://member.bilibili.com/platform/data-up/video/` 并保持标签打开，再重新运行自动化。

claim 成功后，在已打开标签内进入「数据概览」下的「近期稿件对比」模块。若页面结构变化导致无法定位模块，停止任务并报告。

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
- Chrome 插件不可用：停止任务，报告 Chrome Extension 控制通道不可用。
- 未找到已打开的 B站创作中心标签：停止任务，要求手动打开 `https://member.bilibili.com/platform/data-up/video/` 并保持标签打开；不得自动打开该站点。
- 直接打开 B站创作中心被拦截：停止任务，改为要求用户预先打开标签，不尝试修改 Codex 浏览器 session 文件或绕过浏览器策略。
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
