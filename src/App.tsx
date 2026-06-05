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
  UsersRound
} from "lucide-react";
import {
  buildSummary,
  formatCompact,
  formatPercent,
  loadDefaultVideos,
  sortMetricLabels,
  sortVideos,
  type SortMetric,
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

function KpiCard({
  icon,
  label,
  value,
  caption,
  tone = "pink",
  delay = 0
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  caption: string;
  tone?: "pink" | "blue" | "green" | "orange";
  delay?: number;
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
  const [selectedId, setSelectedId] = useState<string>("");
  const [sortMetric, setSortMetric] = useState<SortMetric>("views");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("正在加载默认 CSV 数据...");

  useEffect(() => {
    loadDefaultVideos()
      .then((items) => {
        setVideos(items);
        setSelectedId(items[0]?.id ?? "");
        setStatus(`已载入 ${items.length} 条视频数据`);
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : "CSV 加载失败");
      });
  }, []);

  const sortedVideos = useMemo(() => sortVideos(videos, sortMetric), [videos, sortMetric]);
  const selectedVideo =
    videos.find((video) => video.id === selectedId) ?? sortedVideos[0] ?? null;
  const summary = useMemo(() => buildSummary(videos), [videos]);
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
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: mutedText, width: 120, overflow: "truncate" }
    },
    series: [
      {
        type: "bar",
        data: rankedVideos.map((video) => ({
          value: video.views,
          itemStyle: {
            color:
              selectedVideo?.id === video.id
                ? pink
                : {
                    type: "linear",
                    x: 0,
                    y: 0,
                    x2: 1,
                    y2: 0,
                    colorStops: [
                      { offset: 0, color: "rgba(69,163,255,0.36)" },
                      { offset: 1, color: "rgba(69,163,255,0.88)" }
                    ]
                  },
            borderRadius: [0, 12, 12, 0]
          }
        })),
        barWidth: 18,
        emphasis: { focus: "series" }
      }
    ]
  };

  const qualityOption = {
    backgroundColor: "transparent",
    grid: { left: 48, right: 24, top: 28, bottom: 42 },
    tooltip: {
      backgroundColor: "rgba(12,15,24,0.96)",
      borderColor: "rgba(69,163,255,0.32)",
      textStyle: { color: chartText },
      formatter: (param: any) => {
        const item = videos[param.dataIndex];
        return `<b>${item.title}</b><br/>播放量：${formatCompact(item.views)}<br/>平均播放进度：${formatPercent(
          item.averageProgress
        )}<br/>互动量：${item.interactionTotal}<br/>${interactionInsight(item)}`;
      }
    },
    xAxis: {
      name: "播放量",
      nameTextStyle: { color: mutedText },
      splitLine: { lineStyle: { color: gridLine } },
      axisLabel: { color: mutedText, formatter: (value: number) => formatCompact(value) }
    },
    yAxis: {
      name: "平均播放进度",
      nameTextStyle: { color: mutedText },
      splitLine: { lineStyle: { color: gridLine } },
      axisLabel: { color: mutedText, formatter: (value: number) => formatPercent(value, 0) }
    },
    series: [
      {
        type: "scatter",
        symbolSize: (data: number[]) => Math.max(18, Math.min(54, 18 + data[2] * 4)),
        data: videos.map((video) => [video.views, video.averageProgress, video.interactionTotal]),
        itemStyle: {
          color: (param: any) => (videos[param.dataIndex]?.id === selectedId ? pink : green),
          shadowBlur: 24,
          shadowColor: "rgba(62,226,143,0.28)"
        }
      }
    ]
  };

  const interactionOption = {
    backgroundColor: "transparent",
    legend: { top: 0, right: 0, textStyle: { color: mutedText } },
    grid: { left: 18, right: 12, top: 42, bottom: 24, containLabel: true },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "rgba(12,15,24,0.96)",
      borderColor: "rgba(255,255,255,0.14)",
      textStyle: { color: chartText }
    },
    xAxis: {
      type: "category",
      data: sortedVideos.map((video) => shortTitle(video.title)),
      axisLabel: { color: mutedText, rotate: 26 },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: gridLine } }
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: gridLine } },
      axisLabel: { color: mutedText }
    },
    series: [
      { name: "点赞", type: "bar", stack: "total", data: sortedVideos.map((v) => v.likes), itemStyle: { color: pink } },
      { name: "收藏", type: "bar", stack: "total", data: sortedVideos.map((v) => v.favorites), itemStyle: { color: blue } },
      { name: "评论", type: "bar", stack: "total", data: sortedVideos.map((v) => v.comments), itemStyle: { color: green } },
      { name: "投币", type: "bar", stack: "total", data: sortedVideos.map((v) => v.coins), itemStyle: { color: orange } },
      { name: "弹幕", type: "bar", stack: "total", data: sortedVideos.map((v) => v.danmaku), itemStyle: { color: "#c2f970" } },
      { name: "转发", type: "bar", stack: "total", data: sortedVideos.map((v) => v.shares), itemStyle: { color: "#9b8cff" } }
    ]
  };

  const clickDropOption = {
    backgroundColor: "transparent",
    radar: {
      radius: "65%",
      splitNumber: 4,
      axisName: { color: mutedText },
      splitLine: { lineStyle: { color: gridLine } },
      splitArea: { areaStyle: { color: ["rgba(255,255,255,0.015)", "rgba(255,255,255,0.035)"] } },
      axisLine: { lineStyle: { color: gridLine } },
      indicator: [
        { name: "封标点击", max: 5 },
        { name: "粉丝点击", max: 5 },
        { name: "游客点击", max: 5 },
        { name: "低跳出", max: 1 },
        { name: "互动率", max: 0.08 },
        { name: "完播进度", max: 0.5 }
      ]
    },
    tooltip: {
      backgroundColor: "rgba(12,15,24,0.96)",
      borderColor: "rgba(251,114,153,0.28)",
      textStyle: { color: chartText }
    },
    series: [
      {
        type: "radar",
        data: selectedVideo
          ? [
              {
                value: [
                  selectedVideo.coverClickScore,
                  selectedVideo.fanClickScore,
                  selectedVideo.visitorClickScore,
                  1 - selectedVideo.threeSecondDropRate,
                  selectedVideo.engagementRate,
                  selectedVideo.averageProgress
                ],
                name: selectedVideo.title,
                areaStyle: { color: "rgba(251,114,153,0.22)" },
                lineStyle: { color: pink, width: 2 },
                itemStyle: { color: pink }
              }
            ]
          : []
      }
    ]
  };

  function handleChartClick(params: any) {
    const index = params.dataIndex;
    const video = rankedVideos[index] ?? videos[index] ?? sortedVideos[index];
    if (video) {
      setSelectedId(video.id);
    }
  }

  return (
    <main className="app-shell">
      <div className="orb orb-pink" />
      <div className="orb orb-blue" />
      <div className="grain" />

      <motion.header
        className="hero"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.72, ease: [0.22, 1, 0.36, 1] }}
      >
        <div>
          <div className="eyebrow">
            <Sparkles size={16} />
            黑曜数据舱 · Bilibili Video Intelligence
          </div>
          <h1>B站视频表现驾驶舱</h1>
          <p>
            用真实 CSV 数据追踪播放、点击、留存、互动与粉丝转化，让每条视频的表现差异变得一眼可见。
          </p>
        </div>
        <div className="hero-actions">
          <span className="status-pill">
            <Clock3 size={15} />
            {summary.dateRange}
          </span>
        </div>
      </motion.header>

      <section className="command-bar">
        <div className="status-copy">
          <CircleDot size={16} />
          {status}
        </div>
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
      </section>

      <section className="kpi-grid">
        <KpiCard
          icon={<Flame size={18} />}
          label="总播放量"
          value={formatCompact(summary.totalViews)}
          caption={`最高播放：${summary.bestVideo ? shortTitle(summary.bestVideo.title) : "暂无"}`}
          tone="pink"
          delay={0.04}
        />
        <KpiCard
          icon={<BarChart3 size={18} />}
          label="平均播放"
          value={formatCompact(summary.averageViews)}
          caption={`${videos.length} 条近期稿件参与计算`}
          tone="blue"
          delay={0.1}
        />
        <KpiCard
          icon={<Activity size={18} />}
          label="平均播放进度"
          value={formatPercent(summary.averageProgress)}
          caption={`留存最佳：${summary.topRetentionVideo ? shortTitle(summary.topRetentionVideo.title) : "暂无"}`}
          tone="green"
          delay={0.16}
        />
        <KpiCard
          icon={<UsersRound size={18} />}
          label="总涨粉量"
          value={formatCompact(summary.totalFollowers)}
          caption={`平均互动率 ${formatPercent(summary.averageEngagementRate)}`}
          tone="orange"
          delay={0.22}
        />
      </section>

      <section className="dashboard-grid">
        <ChartPanel title="爆款雷达排行" eyebrow={`按 ${sortMetricLabels[sortMetric]} 排序`} className="span-7">
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

        <ChartPanel title="播放质量象限" eyebrow="播放量 × 平均播放进度 × 互动量" className="span-6">
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
              {filteredVideos.map((video) => (
                <tr
                  key={video.id}
                  className={selectedVideo?.id === video.id ? "selected" : ""}
                  onClick={() => setSelectedId(video.id)}
                >
                  <td>
                    <b>{video.title}</b>
                    <small>{video.publishedLabel}</small>
                  </td>
                  <td>{formatCompact(video.views)}</td>
                  <td>{video.coverClickScore.toFixed(1)} 星</td>
                  <td>{formatPercent(video.threeSecondDropRate)}</td>
                  <td>{formatPercent(video.engagementRate)}</td>
                  <td>{formatPercent(video.averageProgress)}</td>
                  <td>{video.followerGain}</td>
                  <td>{video.interactionTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer>
        <RefreshCcw size={14} />
        所有图表和指标均由 CSV 真实字段计算：播放、点击、跳出、互动、涨粉与播放进度。
      </footer>
    </main>
  );
}

export default App;
