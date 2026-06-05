# B站视频数据自动化拉取 Runbook

## 目标
每天 6:00 由 Codex cron 自动化打开 Chrome，进入 B站创作中心的数据中心「近期稿件对比」模块，勾选全部自选指标并导出 CSV，然后更新仪表盘数据文件并推送到 GitHub。

当前 Codex 自动化 ID：`b-2`

自动化不得运行 Vercel 命令。若 Vercel 项目开启 Git 自动部署，GitHub push 仍可能触发 Vercel 平台侧自动构建，需要在 Vercel 项目设置中关闭。

## 前提条件
1. Windows 本机在每天 6:00 已开机、联网，Codex 可运行本地 cron 自动化。
2. Chrome 已登录 B站创作中心账号，且导出流程不触发验证码或二次验证。
3. Codex Chrome Extension 控制通道可用。
4. 本仓库位于 `F:\zhangbin_codex\b站数据看板1.0版本`。
5. GitHub 已配置 `origin/master` 推送权限。

## 步骤 A：Chrome 浏览器自动化

### A1. 连接 Chrome 扩展
使用 Codex Chrome 工具连接用户 Chrome。若连接失败，停止任务并报告失败原因。

### A2. 查找现有 B站 标签或打开新标签
- 如果已有 B站 创作中心标签，claim 它
- 否则导航到 `https://member.bilibili.com/platform/data/video/compare`

### A3. 进入数据中心 > 近期稿件对比
左侧菜单「数据中心」→「稿件数据」→「近期稿件对比」
或直接导航到：`https://member.bilibili.com/platform/data/video/compare`

### A4. 全选自选指标
页面「自选指标」区域，点击「自定义指标」展开指标选择面板
将所有可用指标全部勾选，确保导出字段至少包含：
`视频标题, 发布时间, 播放量`

### A5. 点击「导出」按钮
点击右上或表格上方的「导出」/「下载」/「导出数据」按钮，选择 CSV 格式

### A6. 等待下载完成
监听 Chrome 下载事件，等待文件出现在下载目录

### A7. 将下载的 CSV 复制到项目
目标路径：`public/data/recent-videos.csv`

## 步骤 B：数据更新 + GitHub 推送
运行：

```powershell
powershell -ExecutionPolicy Bypass -File automation\bilibili-update.ps1
```

脚本完成：
1. 找到下载目录最新近期稿件对比 CSV
2. 验证 CSV 表头包含 `视频标题`、`发布时间`、`播放量`
3. 与 `public/data/recent-videos.csv` 做 SHA256 对比
4. 如果无变化，退出并跳过提交推送
5. 如果有变化，替换数据文件并执行 `git add`、`git commit`、`git push origin master`

## 失败处理
- 登录失效：停止任务，手动在 Chrome 登录 B站后再重试。
- 验证码或二次验证：停止任务，不尝试绕过。
- 页面结构变化：停止任务，重新人工确认按钮和菜单路径。
- 下载失败：停止任务，检查 Chrome 下载权限和下载目录。
- Git 推送失败：检查 GitHub 登录态、网络和 `origin/master` 权限。
