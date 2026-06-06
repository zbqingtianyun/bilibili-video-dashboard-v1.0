# B站视频数据自动化拉取 Runbook

## 目标
每天 06:00 由 Codex cron 自动化通过 CDP 专用 Chrome 进入 B站创作中心「数据概览 / 近期稿件对比」模块，勾选全部自选指标并导出 CSV。CSV 必须直接保存到本项目目录，随后同步更新仪表盘数据文件并推送到 GitHub。

自动化名称：`B站视频数据每日更新`
Codex 自动化 ID：`b`

自动化不得运行 Vercel 命令。Vercel 已关联 GitHub，由平台侧在 GitHub push 后自行处理部署。

## 前提条件
1. Windows 本机每天 06:00 已开机、联网，Codex 可运行本地 cron 自动化。
2. B站创作中心账号已登录，且导出流程不触发验证码、二次验证或人工确认。
3. 只使用 CDP 专用 Chrome 获取 B站数据，不再使用 Chrome 插件通道或独立 Playwright 作为数据获取方式。
4. CDP 专用 Chrome 的下载目录必须固定为本仓库根目录：`F:\zhangbin_codex\b站数据看板1.0版本`。
5. 本仓库 `origin/master` 具备 GitHub 推送权限。
6. CDP 专用 Chrome 使用本仓库下的独立 profile：`F:\zhangbin_codex\b站数据看板1.0版本\.chrome-bilibili-profile`。首次使用时需要在该专用 Chrome 窗口手动登录 B站。

## 步骤 A：CDP 浏览器导出

### A1. 启动或连接 CDP 专用 Chrome
运行：

```powershell
powershell -ExecutionPolicy Bypass -File automation\start-bilibili-cdp-chrome.ps1
```

该脚本负责：
- 检查 `http://127.0.0.1:9222` 是否已可用。
- 不可用时启动专用 Chrome。
- 如果检测到专用 Chrome 残留进程但 `9222` 没有监听，会自动清理残留进程并重启。
- 默认最长等待 90 秒，只有连续多次 CDP 探活成功、且确认端口属于专用 profile 后，才会报告启动成功。
- 如果 Chrome 启动后退出或超时，脚本会输出 Chrome 路径、版本和专用 profile 进程诊断。
- 使用 profile：`F:\zhangbin_codex\b站数据看板1.0版本\.chrome-bilibili-profile`。
- 将下载目录固定为项目根目录。
- 在专用 profile 中关闭 Chrome 对 B站 CSV 下载的安全拦截，避免出现“出于安全原因”导致 CSV 下载失败。

不得读取 cookies、localStorage、密码、浏览器配置文件或其他敏感会话数据。不得绕过验证码、二次验证或站点安全拦截。

### A2. 打开或接管目标页面
目标 URL：

```text
https://member.bilibili.com/platform/data-up/video/
```

连接 `http://127.0.0.1:9222` 后，通过 CDP 打开目标 URL。若页面停在登录页、触发验证码、触发二次验证或无法进入创作中心，则停止任务并报告，需要用户在 CDP 专用 Chrome profile 中完成登录后再重试。

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
- CDP 端口不可用：运行 `automation\start-bilibili-cdp-chrome.ps1` 启动专用 Chrome，等待脚本确认 CDP 可用后，再连接 `http://127.0.0.1:9222`。
- CDP 请求出现 `ECONNREFUSED` / `connection refused`：停止当前 CDP 连接，运行 `powershell -ExecutionPolicy Bypass -File automation\start-bilibili-cdp-chrome.ps1 -Restart` 强制重建专用 Chrome，确认 `-CheckOnly` 成功后再重试一次；仍失败则停止并报告。
- CDP 专用 Chrome 停在登录页或无法进入创作中心：停止任务并报告，需要用户在 `.chrome-bilibili-profile` 对应 Chrome 窗口中完成登录。
- 登录失效：停止任务，要求手动在 Chrome 登录 B站后重试。
- 验证码或二次验证：停止任务，不尝试绕过。
- 页面结构变化：停止任务，要求重新确认按钮和模块路径。
- Chrome 下载目录不是项目根目录：停止任务，不从其他目录搬运 CSV。
- Chrome 下载气泡提示 CSV“出于安全原因”被拦截：重新运行 `automation\start-bilibili-cdp-chrome.ps1`，确保专用 profile 已关闭下载保护；仍失败时停止任务并报告。
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
