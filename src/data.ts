import Papa from "papaparse";

export type RawVideoRow = {
  视频标题: string;
  发布时间: string;
  播放量: string;
  游客播放占比: string;
  粉丝观看率: string;
  封标点击率: string;
  粉丝点击率: string;
  游客点击率: string;
  "3秒跳出率": string;
  粉丝3秒跳出率: string;
  游客3秒跳出率: string;
  互动率: string;
  粉丝互动率: string;
  游客互动率: string;
  涨粉量: string;
  播转粉率: string;
  取关量: string;
  点赞量: string;
  点赞率: string;
  评论量: string;
  评论率: string;
  弹幕量: string;
  弹幕率: string;
  收藏量: string;
  收藏率: string;
  投币量: string;
  投币率: string;
  转发量: string;
  转发率: string;
  平均播放进度: string;
};

export type VideoMetric = {
  id: string;
  title: string;
  publishedAt: Date | null;
  publishedLabel: string;
  views: number;
  visitorViewShare: number;
  fanViewRate: number;
  coverClickScore: number;
  fanClickScore: number;
  visitorClickScore: number;
  threeSecondDropRate: number;
  fanThreeSecondDropRate: number;
  visitorThreeSecondDropRate: number;
  engagementRate: number;
  fanEngagementRate: number;
  visitorEngagementRate: number;
  followerGain: number;
  viewToFollowerRate: number;
  unfollows: number;
  likes: number;
  likeRate: number;
  comments: number;
  commentRate: number;
  danmaku: number;
  danmakuRate: number;
  favorites: number;
  favoriteRate: number;
  coins: number;
  coinRate: number;
  shares: number;
  shareRate: number;
  averageProgress: number;
  interactionTotal: number;
  qualityScore: number;
};

export type VideoDelta = {
  views: number;
  engagementRate: number;
  followerGain: number;
  coverClickScore: number;
  averageProgress: number;
  likes: number;
};

export type DashboardSummary = {
  totalViews: number;
  averageViews: number;
  averageProgress: number;
  averageEngagementRate: number;
  totalFollowers: number;
  averageCoverScore: number;
  bestVideo: VideoMetric | null;
  topRetentionVideo: VideoMetric | null;
  dateRange: string;
  /* 相对上一版的聚合变化 */
  totalViewsDelta: number;
  averageEngagementDelta: number;
  totalFollowersDelta: number;
};

export type SortMetric =
  | "views"
  | "engagementRate"
  | "averageProgress"
  | "followerGain"
  | "coverClickScore";

const percentFields = new Set([
  "游客播放占比",
  "粉丝观看率",
  "3秒跳出率",
  "粉丝3秒跳出率",
  "游客3秒跳出率",
  "互动率",
  "粉丝互动率",
  "游客互动率",
  "播转粉率",
  "点赞率",
  "评论率",
  "弹幕率",
  "收藏率",
  "投币率",
  "转发率",
  "平均播放进度"
]);

export const sortMetricLabels: Record<SortMetric, string> = {
  views: "播放量",
  engagementRate: "互动率",
  averageProgress: "平均播放进度",
  followerGain: "涨粉量",
  coverClickScore: "封标点击率"
};

export function parseNumber(value: string | number | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (!value) {
    return 0;
  }
  const normalized = String(value).replace(/,/g, "").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parsePercent(value: string | undefined): number {
  if (!value) {
    return 0;
  }
  return parseNumber(value.replace("%", "")) / 100;
}

export function parseStarScore(value: string | undefined): number {
  if (!value) {
    return 0;
  }
  return parseNumber(value.replace("星", ""));
}

export function parseChineseDate(value: string): Date | null {
  const match = value.match(
    /(\d{4})年(\d{2})月(\d{2})日\s+(\d{2}):(\d{2}):(\d{2})/
  );
  if (!match) {
    return null;
  }
  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
}

export function formatPercent(value: number, digits = 1): string {
  return (value * 100).toFixed(digits) + "%";
}

export function formatCompact(value: number): string {
  if (value >= 10000) {
    return (value / 10000).toFixed(1) + "万";
  }
  return Math.round(value).toLocaleString("zh-CN");
}

export function formatDelta(value: number, isPercent?: boolean): string {
  if (value === 0) return "—";
  const sign = value > 0 ? "+" : "";
  if (isPercent) {
    return sign + (value * 100).toFixed(1) + "pp";
  }
  return sign + formatCompact(Math.abs(value));
}

export function normalizeRow(row: RawVideoRow, index: number): VideoMetric {
  const publishedAt = parseChineseDate(row.发布时间);
  const likes = parseNumber(row.点赞量);
  const comments = parseNumber(row.评论量);
  const danmaku = parseNumber(row.弹幕量);
  const favorites = parseNumber(row.收藏量);
  const coins = parseNumber(row.投币量);
  const shares = parseNumber(row.转发量);
  const views = parseNumber(row.播放量);
  const engagementRate = parsePercent(row.互动率);
  const averageProgress = parsePercent(row.平均播放进度);
  const followerGain = parseNumber(row.涨粉量);
  const interactionTotal = likes + comments + danmaku + favorites + coins + shares;

  return {
    id: index + "-" + row.视频标题,
    title: row.视频标题.trim().replace(/，$/, ""),
    publishedAt,
    publishedLabel: row.发布时间,
    views,
    visitorViewShare: parsePercent(row.游客播放占比),
    fanViewRate: parsePercent(row.粉丝观看率),
    coverClickScore: parseStarScore(row.封标点击率),
    fanClickScore: parseStarScore(row.粉丝点击率),
    visitorClickScore: parseStarScore(row.游客点击率),
    threeSecondDropRate: parsePercent(row["3秒跳出率"]),
    fanThreeSecondDropRate: parsePercent(row.粉丝3秒跳出率),
    visitorThreeSecondDropRate: parsePercent(row.游客3秒跳出率),
    engagementRate,
    fanEngagementRate: parsePercent(row.粉丝互动率),
    visitorEngagementRate: parsePercent(row.游客互动率),
    followerGain,
    viewToFollowerRate: parsePercent(row.播转粉率),
    unfollows: parseNumber(row.取关量),
    likes,
    likeRate: parsePercent(row.点赞率),
    comments,
    commentRate: parsePercent(row.评论率),
    danmaku,
    danmakuRate: parsePercent(row.弹幕率),
    favorites,
    favoriteRate: parsePercent(row.收藏率),
    coins,
    coinRate: parsePercent(row.投币率),
    shares,
    shareRate: parsePercent(row.转发率),
    averageProgress,
    interactionTotal,
    qualityScore:
      views * 0.35 +
      interactionTotal * 18 +
      averageProgress * 420 +
      engagementRate * 360 +
      followerGain * 80
  };
}

export function parseCsv(text: string): VideoMetric[] {
  const parsed = Papa.parse<RawVideoRow>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transform: (value, field) => {
      if (typeof field === "string" && percentFields.has(field)) {
        return value.trim();
      }
      return value.trim();
    }
  });

  if (parsed.errors.length > 0) {
    throw new Error(parsed.errors.map((error) => error.message).join("; "));
  }

  return parsed.data
    .filter((row) => row.视频标题 && row.发布时间)
    .map((row, index) => normalizeRow(row, index));
}

export async function loadDefaultVideos(): Promise<VideoMetric[]> {
  const response = await fetch("/data/recent-videos.csv");
  if (!response.ok) {
    throw new Error("CSV 加载失败：" + response.status);
  }
  return parseCsv(await response.text());
}

export async function loadPrevVideos(): Promise<VideoMetric[]> {
  const response = await fetch("/data/recent-videos-prev.csv");
  if (!response.ok) {
    return [];
  }
  return parseCsv(await response.text());
}

/** 按视频标题匹配，计算每个视频关键指标的差值 */
export function computeDeltas(
  current: VideoMetric[],
  previous: VideoMetric[]
): Map<string, VideoDelta> {
  const map = new Map<string, VideoDelta>();
  const prevByTitle = new Map(previous.map((v) => [v.title, v]));
  for (const cur of current) {
    const prev = prevByTitle.get(cur.title);
    if (!prev) continue;
    map.set(cur.title, {
      views: cur.views - prev.views,
      engagementRate: cur.engagementRate - prev.engagementRate,
      followerGain: cur.followerGain - prev.followerGain,
      coverClickScore: cur.coverClickScore - prev.coverClickScore,
      averageProgress: cur.averageProgress - prev.averageProgress,
      likes: cur.likes - prev.likes
    });
  }
  return map;
}

export function buildSummary(videos: VideoMetric[], deltas?: Map<string, VideoDelta>): DashboardSummary {
  const totalViews = videos.reduce((sum, item) => sum + item.views, 0);
  const totalFollowers = videos.reduce((sum, item) => sum + item.followerGain, 0);
  const averageViews = videos.length ? totalViews / videos.length : 0;
  const averageProgress =
    videos.reduce((sum, item) => sum + item.averageProgress, 0) / (videos.length || 1);
  const averageEngagementRate =
    videos.reduce((sum, item) => sum + item.engagementRate, 0) / (videos.length || 1);
  const averageCoverScore =
    videos.reduce((sum, item) => sum + item.coverClickScore, 0) / (videos.length || 1);
  const sortedDates = videos
    .map((video) => video.publishedAt)
    .filter(Boolean)
    .sort((a, b) => a!.getTime() - b!.getTime()) as Date[];
  const formatDate = (date: Date) =>
    date.getFullYear() + "." + String(date.getMonth() + 1).padStart(2, "0") + "." + String(
      date.getDate()
    ).padStart(2, "0");

  let totalViewsDelta = 0;
  let totalFollowersDelta = 0;
  let averageEngagementDelta = 0;
  if (deltas) {
    for (const d of deltas.values()) {
      totalViewsDelta += d.views;
      totalFollowersDelta += d.followerGain;
      averageEngagementDelta += d.engagementRate;
    }
    if (deltas.size > 0) {
      averageEngagementDelta /= deltas.size;
    }
  }

  return {
    totalViews,
    averageViews,
    averageProgress,
    averageEngagementRate,
    totalFollowers,
    averageCoverScore,
    bestVideo: [...videos].sort((a, b) => b.views - a.views)[0] ?? null,
    topRetentionVideo:
      [...videos].sort((a, b) => b.averageProgress - a.averageProgress)[0] ?? null,
    dateRange: sortedDates.length
      ? formatDate(sortedDates[0]) + " - " + formatDate(sortedDates[sortedDates.length - 1])
      : "暂无时间范围",
    totalViewsDelta,
    averageEngagementDelta,
    totalFollowersDelta
  };
}

export function sortVideos(videos: VideoMetric[], sortMetric: SortMetric): VideoMetric[] {
  return [...videos].sort((a, b) => b[sortMetric] - a[sortMetric]);
}
