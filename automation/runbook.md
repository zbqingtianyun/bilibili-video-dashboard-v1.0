# B站视频数据自动化拉取 Runbook

## 目标
每天 6:00 由 Codex cron 自动化通过 Google Chrome 插件通道打开 Chrome，进入 B站创作中心的数据中心「近期稿件对比」模块，勾选全部自选指标并导出 CSV，然后替换项目目录里的原始 CSV，同步更新仪表盘数据文件并推送到 GitHub。

当前 Codex 自动化 ID：`b-2`

自动化不得运行 Vercel 命令。若 Vercel 项目开启 Git 自动部署，GitHub push 仍可能触发 Vercel 平台侧自动构建，需要在 Vercel 项目设置中关闭。

## 前提条件
1. Windows 本机在每天 6:00 已开机、联网，Codex 可运行本地 cron 自动化。
2. Chrome 已登录 B站创作中心账号，且导出流程不触发验证码或二次验证。
3. Codex Chrome Extension / Google Chrome 插件控制通道可用。
4. 本仓库位于 `F:\zhangbin_codex\b站数据看板1.0版本`。
5. GitHub 已配置 `origin/master` 推送权限。

## 步骤 A：Google Chrome 插件自动化

### A1. 修正 Codex 浏览器来源权限
先运行：

```powershell
powershell -ExecutionPolicy Bypass -File automation\allow-bilibili-browser-origin.ps1
```

该脚本会把本机 Codex 浏览器 session 中的 `https://member.bilibili.com` 从 `denied` 修正为 `allowed`，避免自动化每次新运行生成新的拒绝记录。

### A2. 连接 Chrome 扩展
必须使用 Codex Chrome Extension / Google Chrome 插件通道连接用户 Chrome。若连接失败，停止任务并报告失败原因，不改用 Codex in-app Browser、独立 Playwright 浏览器、CDP 临时浏览器或无登录态的新浏览器环境。

### A3. 查找现有 B站 标签或打开新标签
- 如果已有 B站 创作中心标签，claim 它
- 否则导航到 `https://member.bilibili.com/platform/data/video/compare`

### A4. 进入数据中心 > 近期稿件对比
左侧菜单「数据中心」→「稿件数据」→「近期稿件对比」
或直接导航到：`https://member.bilibili.com/platform/data/video/compare`

### A5. 全选自选指标
页面「自选指标」区域，点击「自定义指标」展开指标选择面板
将所有可用指标全部勾选，确保导出字段至少包含：
`视频标题, 发布时间, 播放量`

### A6. 点击「导出」按钮
点击右上或表格上方的「导出」/「下载」/「导出数据」按钮，选择 CSV 格式。
Chrome 下载目录就是项目根目录，CSV 必须直接保存到：
`F:\zhangbin_codex\b站数据看板1.0版本\近期稿件对比.csv`

### A7. 等待下载完成
监听 Chrome 下载事件，等待文件出现在项目目录

### A8. 将下载的 CSV 同步到项目
目标路径：
`近期稿件对比.csv`
`public/data/recent-videos.csv`

`public/data/recent-videos.csv` 是仪表盘前端实际读取的数据源，必须由最新 CSV 替换。

## 步骤 B：数据更新 + GitHub 推送
运行：

```powershell
powershell -ExecutionPolicy Bypass -File automation\bilibili-update.ps1
```

脚本完成：
1. 从项目目录中找到最新近期稿件对比 CSV
2. 验证 CSV 表头包含 `视频标题`、`发布时间`、`播放量`
3. 与 `public/data/recent-videos.csv` 做 SHA256 对比
4. 如果无变化，退出并跳过提交推送
5. 如果有变化，替换 `近期稿件对比.csv` 和仪表盘实际数据源 `public/data/recent-videos.csv`，再执行 `git add`、`git commit`、`git push origin master`

## 失败处理
- 浏览器提示「用户已请求禁止使用该站点」：先运行 `automation\allow-bilibili-browser-origin.ps1`，它会检查 `C:\Users\26230\.codex\browser\sessions\*.toml` 并把 `https://member.bilibili.com` 从 `denied` 修正为 `allowed`，然后只重试一次。
- 如果放行脚本提示 `UnauthorizedAccessException` 或某个 session 文件无法写入：通常是当前 Chrome 插件会话正在占用该 session 文件。脚本会跳过该被锁文件并继续确保 `bilibili-creator-center.toml` 放行文件存在；若重试后仍被浏览器策略拦截，需要关闭当前被拦截的自动化浏览器会话后重新触发任务。
- 登录失效：停止任务，手动在 Chrome 登录 B站后再重试。
- 验证码或二次验证：停止任务，不尝试绕过。
- 页面结构变化：停止任务，重新人工确认按钮和菜单路径。
- 下载失败：停止任务，检查 Chrome 下载权限和下载目录。
- Git 推送失败：检查 GitHub 登录态、网络和 `origin/master` 权限。
