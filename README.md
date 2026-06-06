# B站视频表现驾驶舱 v1.0

基于真实 B 站近期稿件 CSV 数据构建的 Web 数据仪表盘，采用苹果极简风与黑曜数据舱视觉方向。

## 本地运行

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## 接管当前 Chrome 页面

自动化脚本只连接已打开的 Google Chrome 页面，不会新开页面：

```bash
npm run automation:chrome
```

前提：Chrome 需已用远程调试端口启动，例如 `--remote-debugging-port=9222`。如需指定页面，可设置 `TARGET_URL_KEYWORD` 匹配当前标签 URL。

## 数据来源

默认数据文件位于 `public/data/recent-videos.csv`，字段来自根目录的 `近期稿件对比.csv`。
