import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  CircleDot,
  Clock3,
  Flame,
  RefreshCcw,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UsersRound
} from "lucide-react";
import {
  buildSummary,
  computeDeltas,
  formatCompact,
  formatDelta,
  formatPercent,
  loadDefaultVideos,
  loadPrevVideos,
  sortMetricLabels,
  sortVideos,
  type SortMetric,
  type VideoDelta,
  type VideoMetric
} from "./data";

const chartText = "#e9edf7";
const mutedText = "#8a91a3";
const gridLine = "rgba(255,255,255,0.08)";
const pink = "#fb7299";
const blue = "#45a3ff";
const green = "#3ee28f";
const orange = "#ffb86b";

const metricOptions: SortMetric[] = [
  "views",
  "engagementRate",
  "averageProgress",
  "followerGain",
  "coverClickScore"
];

function shortTitle(title: string): string {
  return title.length > 16 ? `${title.slice(0, 16)}...` : title;
}

function interactionInsight(video: VideoMetric): string {
  if (video.threeSecondDropRate > 0.5) {
    return "开头跳出偏高，建议复盘前 3 秒钩子。";
  }
  if (video.averageProgress > 0.35 && video.engagementRate > 0.04) {
    return "留存和互动都更健康，适合作为复盘样本。";
  }
  if (video.coverClickScore >= 4) {
    return "封标点击表现强，可以沉淀为标题封面模板。";
  }
  return "表现稳定，可继续观察同类选题。";
}

function DeltaBadge({ delta, isPercent }: { delta: number; isPercent?: boolean }) {
  if (Math.abs(delta) < 0.0001) {
    return <span className="delta-zero">&mdash;</span>;
  }
  const up = delta > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`delta-badge ${up ? "delta-up" : "delta-down"}`}>
      <Icon size={13} />
      {formatDelta(delta, isPercent)}
    </span>
  );
}

function KpiCard({
  icon,
  label,
  value,
  caption,
  tone = "pink",
  delay = 0,
  delta
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  caption: string;
  tone?: "pink" | "blue" | "green" | "orange";
  delay?: number;
  delta?: number;
}) {
  return (
    <motion.section
      className={`kpi-card tone-${tone}`}
      initial={{ opacity: 0, y: 22, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.62, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="kpi-top">
        <span className="kpi-icon">{icon}</span>
        <span>{label}</span>
        {delta !== undefined && <DeltaBadge delta={delta} />}
      </div>
      <strong>{value}</strong>
      <p>{caption}</p>
    </motion.section>
  );
}

function ChartPanel({
  title,
  eyebrow,
  children,
  className = ""
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      className={`chart-panel ${className}`}
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="panel-title">
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {children}
    </motion.section>
  );
}

function App() {
  const [videos, setVideos] = useState<VideoMetric[]>([]);
  const [prevVideos, setPrevVideos] = useState<VideoMetric[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [sortMetric, setSortMetric] = useState<SortMetric>("views");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("正在加载默认 CSV 数据...");

  useEffect(() => {
    Promise.all([loadDefaultVideos(), loadPrevVideos()])
      .then(([items, prevItems]) => {
        setVideos(items);
        setPrevVideos(prevItems);
        setSelectedId(items[0]?.id ?? "");
        const deltaInfo = prevItems.length
          ? "，检测到上一版数据，已计算变化"
          : "";
        setStatus(`已载入 ${items.length} 条视频数据${deltaInfo}`);
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : "CSV 加载失败");
      });
  }, []);

  const deltas = useMemo(() => computeDeltas(videos, prevVideos), [videos, prevVideos]);
  const sortedVideos = useMemo(() => sortVideos(videos, sortMetric), [videos, sortMetric]);
  const selectedVideo =
    videos.find((video) => video.id === selectedId) ?? sortedVideos[0] ?? null;
  const summary = useMemo(() => buildSummary(videos, deltas), [videos, deltas]);
  const filteredVideos = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return sortedVideos;
    }
    return sortedVideos.filter((video) => video.title.toLowerCase().includes(normalizedQuery));
  }, [query, sortedVideos]);

  const rankedVideos = sortedVideos.slice().reverse();

  const rankingOption = {
    backgroundColor: "transparent",
    grid: { left: 18, right: 26, top: 20, bottom: 18, containLabel: true },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "rgba(12,15,24,0.96)",
      borderColor: "rgba(251,114,153,0.28)",
      textStyle: { color: chartText },
      formatter: (params: any) => {
        const item = rankedVideos[params[0].dataIndex];
        return `<b>${item.title}</b><br/>播放量：${formatCompact(item.views)}<br/>互动率：${formatPercent(
          item.engagementRate
        )}<br/>平均播放进度：${formatPercent(item.averageProgress)}<br/>涨粉量：${item.followerGain}`;
      }
    },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: gridLine } },
      axisLabel: { color: mutedText, formatter: (value: number) => formatCompact(value) }
    },
    yAxis: {
      type: "category",
      data: rankedVideos.map((video) => shortTitle(video.title)),
      axisLine: { lineStyle: { color: gridLine } },
      axisLabel: { color: chartText, width: 128, overflow: "truncate" }
    },
    series: [
      {
        name: "播放量",
        type: "bar",
        data: rankedVideos.map((video) => video.views),
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: (() => {
            const echarts = (window as any).echarts;
            return echarts?.graphic?.LinearGradient
              ? new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                  { offset: 0, color: pink },
                  { offset: 1, color: blue }
                ])
              : pink;
          })()
        },
        barWidth: 22,
        emphasis: { itemStyle: { color: pink } }
      }
    ]
  };

  const retentionOption = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(12,15,24,0.96)",
      borderColor: "rgba(251,114,153,0.28)",
      textStyle: { color: chartText }
    },
    grid: { left: 14, right: 14, top: 26, bottom: 28 },
    xAxis: {
      type: "category",
      data: sortedVideos.map((video) => shortTitle(video.title)),
      axisLine: { lineStyle: { color: gridLine } },
      axisLabel: { color: mutedText, rotate: 18 }
    },
    yAxis: {
      type: "value",
      max: 1,
      axisLabel: { color: mutedText, formatter: (v: number) => formatPercent(v, 0) },
      splitLine: { lineStyle: { color: gridLine } }
    },
    series: [
      {
        name: "3秒跳出率",
        type: "bar",
        data: sortedVideos.map((video) => video.threeSecondDropRate),
        itemStyle: { color: pink, borderRadius: [6, 6, 0, 0] },
        barGap: "30%"
      },
      {
        name: "平均播放进度",
        type: "bar",
        data: sortedVideos.map((video) => video.averageProgress),
        itemStyle: { color: green, borderRadius: [6, 6, 0, 0] }
      }
    ]
  };

  const clickDropOption = {
    backgroundColor: "transparent",
    tooltip: { trigger: "item", backgroundColor: "rgba(12,15,24,0.96)", borderColor: "rgba(251,114,153,0.28)" },
    radar: {
      center: ["50%", "50%"],
      radius: "62%",
      indicator: [
        { name: "封标点击", max: 5 },
        { name: "播放进度", max: 1 },
        { name: "互动率", max: 0.1 }
      ],
      axisName: { color: mutedText, fontSize: 11 },
      splitArea: { areaStyle: { color: [gridLine, gridLine, gridLine, gridLine, gridLine] } },
      splitLine: { lineStyle: { color: gridLine } },
      axisLine: { lineStyle: { color: gridLine } }
    },
    series: [
      {
        type: "radar",
        data: selectedVideo
          ? [
              {
                value: [
                  selectedVideo.coverClickScore,
                  selectedVideo.averageProgress,
                  selectedVideo.engagementRate
                ],
                name: selectedVideo.title,
                areaStyle: { color: pink, opacity: 0.18 },
                lineStyle: { color: pink, width: 2 }
              }
            ]
          : [],
        symbol: "circle",
        symbolSize: 8
      }
    ]
  };

  const qualityOption = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(12,15,24,0.96)",
      borderColor: "rgba(251,114,153,0.28)",
      textStyle: { color: chartText },
      formatter: (params: any) => {
        const item = videos[params.dataIndex];
        return `<b>${item.title}</b><br/>播放量：${formatCompact(item.views)}<br/>进度：${formatPercent(
          item.averageProgress
        )}<br/>互动：${item.interactionTotal}`;
      }
    },
    grid: { left: 54, right: 26, top: 18, bottom: 28 },
    xAxis: {
      name: "播放量",
      nameLocation: "center",
      nameGap: 32,
      nameTextStyle: { color: mutedText },
      type: "value",
      axisLabel: { color: mutedText, formatter: (v: number) => formatCompact(v) },
      splitLine: { lineStyle: { color: gridLine } }
    },
    yAxis: {
      name: "平均播放进度",
      nameLocation: "center",
      nameGap: 40,
      nameTextStyle: { color: mutedText },
      type: "value",
      max: 1,
      axisLabel: { color: mutedText, formatter: (v: number) => formatPercent(v, 0) },
      splitLine: { lineStyle: { color: gridLine } }
    },
    series: [
      {
        type: "scatter",
        data: videos.map((video) => [video.views, video.averageProgress]),
        symbolSize: (val: number[]) => {
          const item = videos.find((v) => v.views === val[0]);
          return Math.max(12, Math.min(52, (item?.interactionTotal ?? 0) * 0.4 + 9));
        },
        itemStyle: {
          color: pink,
          borderColor: "rgba(251,114,153,0.35)",
          borderWidth: 2,
          opacity: 0.88
        }
      }
    ]
  };

  const interactionOption = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(12,15,24,0.96)",
      borderColor: "rgba(251,114,153,0.28)",
      textStyle: { color: chartText }
    },
    grid: { left: 14, right: 14, top: 14, bottom: 28 },
    xAxis: {
      type: "category",
      data: sortedVideos.map((video) => shortTitle(video.title)),
      axisLine: { lineStyle: { color: gridLine } },
      axisLabel: { color: mutedText, rotate: 18 }
    },
    yAxis: {
      type: "value",
      axisLabel: { color: mutedText },
      splitLine: { lineStyle: { color: gridLine } }
    },
    series: [
      { name: "点赞", type: "bar", data: sortedVideos.map((v) => v.likes), stack: "interact", itemStyle: { color: pink }, barWidth: 20 },
      { name: "评论", type: "bar", data: sortedVideos.map((v) => v.comments), stack: "interact", itemStyle: { color: blue } },
      { name: "弹幕", type: "bar", data: sortedVideos.map((v) => v.danmaku), stack: "interact", itemStyle: { color: green } },
      { name: "收藏", type: "bar", data: sortedVideos.map((v) => v.favorites), stack: "interact", itemStyle: { color: orange } },
      { name: "投币", type: "bar", data: sortedVideos.map((v) => v.coins), stack: "interact", itemStyle: { color: "#c084fc" } },
      { name: "转发", type: "bar", data: sortedVideos.map((v) => v.shares), stack: "interact", itemStyle: { color: "#fbbf24" } }
    ]
  };

  const handleChartClick = (params: any) => {
    const item = rankedVideos[params.dataIndex];
    if (item) setSelectedId(item.id);
  };

  return (
    <main className="app-shell">
      <div className="grain" />
      <div className="orb orb-pink" />
      <div className="orb orb-blue" />

      <header className="hero">
        <div>
          <span className="eyebrow">
            <Flame size={15} /> Bilibili Creator Cockpit
          </span>
          <h1>B站视频<br />表现驾驶舱</h1>
          <p>
            基于导出 CSV 构建的创作者数据面板。覆盖播放、留存、互动和涨粉四大维度，帮助你快速发现高价值选题与优化方向。
          </p>
        </div>
        <div className="hero-actions">
          <span className="status-pill">
            <CircleDot size={13} color={green} />
            {status}
          </span>
        </div>
      </header>

      <div className="command-bar">
        <div className="segmented">
          {metricOptions.map((metric) => (
            <button
              key={metric}
              className={sortMetric === metric ? "active" : ""}
              onClick={() => setSortMetric(metric)}
            >
              {sortMetricLabels[metric]}
            </button>
          ))}
        </div>
      </div>

      <section className="kpi-grid">
        <KpiCard
          icon={<BarChart3 size={18} />}
          label="总播放量"
          value={formatCompact(summary.totalViews)}
          caption={`${summary.totalViews.toLocaleString("zh-CN")} 次，环比变化 ${summary.totalViewsDelta >= 0 ? "+" : ""}${formatCompact(Math.abs(summary.totalViewsDelta))}`}
          tone="pink"
          delay={0}
          delta={summary.totalViewsDelta}
        />
        <KpiCard
          icon={<Clock3 size={18} />}
          label="平均播放进度"
          value={formatPercent(summary.averageProgress)}
          caption={`${summary.averageProgress >= 0.35 ? "超过 35% 基准线" : "低于 35% 基准线"}，${summary.dateRange}`}
          tone="blue"
          delay={0.08}
        />
        <KpiCard
          icon={<Sparkles size={18} />}
          label="平均互动率"
          value={formatPercent(summary.averageEngagementRate)}
          caption={
            summary.averageEngagementDelta !== 0
              ? `环比 ${formatDelta(summary.averageEngagementDelta, true)}`
              : "与上一版持平"
          }
          tone="green"
          delay={0.16}
          delta={summary.averageEngagementDelta}
        />
        <KpiCard
          icon={<UsersRound size={18} />}
          label="总涨粉量"
          value={formatCompact(summary.totalFollowers)}
          caption={`净增长 ${summary.totalFollowers} 人`}
          tone="orange"
          delay={0.24}
          delta={summary.totalFollowersDelta}
        />
      </section>

      <section className="dashboard-grid">
        <ChartPanel title="播放量排行" eyebrow="Bar Chart" className="span-7">
          <ReactECharts
            option={rankingOption}
            className="chart chart-large"
            onEvents={{ click: handleChartClick }}
            notMerge
          />
        </ChartPanel>

        <ChartPanel title="选中视频体检" eyebrow="点击任意图表或表格联动" className="span-5 detail-panel">
          <AnimatePresence mode="wait">
            {selectedVideo && (
              <motion.div
                key={selectedVideo.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.34 }}
                className="video-detail"
              >
                <span className="video-date">{selectedVideo.publishedLabel}</span>
                <h3>{selectedVideo.title}</h3>
                <p>{interactionInsight(selectedVideo)}</p>
                <div className="detail-metrics">
                  <span>播放 <b>{formatCompact(selectedVideo.views)}</b></span>
                  <span>封标 <b>{selectedVideo.coverClickScore.toFixed(1)} 星</b></span>
                  <span>3秒跳出 <b>{formatPercent(selectedVideo.threeSecondDropRate)}</b></span>
                  <span>播转粉 <b>{formatPercent(selectedVideo.viewToFollowerRate)}</b></span>
                </div>
                <div className="split-bars">
                  <div>
                    <span>游客播放占比</span>
                    <i style={{ width: `${selectedVideo.visitorViewShare * 100}%` }} />
                    <b>{formatPercent(selectedVideo.visitorViewShare, 0)}</b>
                  </div>
                  <div>
                    <span>粉丝观看率</span>
                    <i style={{ width: `${selectedVideo.fanViewRate * 100}%` }} />
                    <b>{formatPercent(selectedVideo.fanViewRate, 0)}</b>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <ReactECharts option={clickDropOption} className="chart chart-radar" notMerge />
        </ChartPanel>

        <ChartPanel title="播放质量象限" eyebrow="播放量 x 平均播放进度 x 互动量" className="span-6">
          <ReactECharts
            option={qualityOption}
            className="chart"
            onEvents={{
              click: (params: any) => {
                const item = videos[params.dataIndex];
                if (item) setSelectedId(item.id);
              }
            }}
            notMerge
          />
        </ChartPanel>

        <ChartPanel title="互动资产结构" eyebrow="点赞 / 评论 / 弹幕 / 收藏 / 投币 / 转发" className="span-6">
          <ReactECharts option={interactionOption} className="chart" notMerge />
        </ChartPanel>
      </section>

      <section className="table-panel">
        <div className="table-head">
          <div>
            <span>Video Ledger</span>
            <h2>视频明细对比</h2>
          </div>
          <label className="search-box">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索视频标题"
            />
          </label>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>视频标题</th>
                <th>播放量</th>
                <th>封标点击</th>
                <th>3秒跳出</th>
                <th>互动率</th>
                <th>平均进度</th>
                <th>涨粉</th>
                <th>互动资产</th>
              </tr>
            </thead>
            <tbody>
              {filteredVideos.map((video) => {
                const d = deltas.get(video.title);
                return (
                  <tr
                    key={video.id}
                    className={selectedVideo?.id === video.id ? "selected" : ""}
                    onClick={() => setSelectedId(video.id)}
                  >
                    <td>
                      <b>{video.title}</b>
                      <small>{video.publishedLabel}</small>
                      {d && d.views !== 0 && (
                        <span className={`td-delta ${d.views > 0 ? "delta-up" : "delta-down"}`}>
                          {d.views > 0 ? "\u2191" : "\u2193"}{formatCompact(Math.abs(d.views))}
                        </span>
                      )}
                    </td>
                    <td>{formatCompact(video.views)}</td>
                    <td>{video.coverClickScore.toFixed(1)} 星</td>
                    <td>{formatPercent(video.threeSecondDropRate)}</td>
                    <td>
                      {formatPercent(video.engagementRate)}
                      {d && d.engagementRate !== 0 && (
                        <span className={`td-delta ${d.engagementRate > 0 ? "delta-up" : "delta-down"}`}>
                          {d.engagementRate > 0 ? "\u2191" : "\u2193"}{Math.abs(d.engagementRate * 100).toFixed(1)}pp
                        </span>
                      )}
                    </td>
                    <td>{formatPercent(video.averageProgress)}</td>
                    <td>
                      {video.followerGain}
                      {d && d.followerGain !== 0 && (
                        <span className={`td-delta ${d.followerGain > 0 ? "delta-up" : "delta-down"}`}>
                          {d.followerGain > 0 ? "\u2191" : "\u2193"}{Math.abs(d.followerGain)}
                        </span>
                      )}
                    </td>
                    <td>{video.interactionTotal}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <footer>
        <RefreshCcw size={14} />
        所有图表和指标均由 CSV 真实字段计算：播放、点击、跳出、互动、涨粉与播放进度。{deltas.size > 0 ? "  \u2191\u2193 标注为相对上一版 CSV 的变化。" : ""}
      </footer>
    </main>
  );
}

export default App;
