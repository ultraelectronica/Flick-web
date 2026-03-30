import { animate, stagger } from "motion";

const REPO_OWNER = "ultraelectronica";
const REPO_NAME = "Flick";
const RELEASES_PER_PAGE = 100;
const MAX_RELEASE_PAGES = 10;
const LEGACY_WEBSITE_DOWNLOAD_CLICK_STORAGE_KEY = "flick-website-download-clicks";
const WEBSITE_DOWNLOAD_CLICK_TIMESTAMPS_STORAGE_KEY =
  "flick-website-download-click-timestamps";
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const PERIOD_DAYS = {
  "30d": 30,
  "90d": 90,
  "180d": 180,
  "365d": 365,
} as const;

const PERIOD_LABELS = {
  "30d": "30 days",
  "90d": "90 days",
  "180d": "180 days",
  "365d": "1 year",
  all: "all time",
} as const;

const numberFormatter = new Intl.NumberFormat("en-US");
const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});
const monthDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

type ChartPeriod = keyof typeof PERIOD_LABELS;
type BucketResolution = "day" | "week" | "month";
type TimelineChartMode = "desktop" | "mobile";

interface GitHubReleaseAsset {
  browser_download_url: string;
  download_count?: number;
  name: string;
  size?: number;
}

interface GitHubRelease {
  assets?: GitHubReleaseAsset[];
  body?: string;
  draft?: boolean;
  html_url?: string;
  name?: string;
  prerelease?: boolean;
  published_at?: string;
  tag_name: string;
}

interface GitHubRepositoryInfo {
  stargazers_count?: number;
}

interface TimelineBarPoint {
  detail: string;
  shortLabel: string;
  value: number;
}

interface TimelineChartLayout {
  chartHeight: number;
  chartWidth: number;
  emptyMinHeightClass: string;
  labelFrequency: number;
  maxBarWidth: number;
  minBarWidth: number;
  mode: TimelineChartMode;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  showScrollHint: boolean;
  svgClassName: string;
  xAxisFontSize: number;
  yAxisFontSize: number;
}

let releaseCachePromise: Promise<GitHubRelease[]> | null = null;
let repositoryInfoCachePromise: Promise<GitHubRepositoryInfo> | null = null;
let activeReleasePeriod: ChartPeriod = "90d";
let releaseNotesResizeListenerBound = false;
let releaseNotesResizeTimer = 0;

function formatCount(value: number): string {
  return numberFormatter.format(value);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function setTextContent(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function setInnerHtml(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) {
    element.innerHTML = value;
  }
}

function renderRepositoryStars(starCount?: number): void {
  const formattedCount =
    typeof starCount === "number" ? formatCount(starCount) : "--";

  setTextContent("repo-star-count", formattedCount);
  setTextContent("release-repo-star-count", formattedCount);
}

function getReleasePageUrl(tagName?: string): string {
  if (!tagName) {
    return `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`;
  }

  return `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/tag/${encodeURIComponent(tagName)}`;
}

function getTrackedAssets(release: GitHubRelease): GitHubReleaseAsset[] {
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const apkAssets = assets.filter((asset) => asset.name.endsWith(".apk"));
  return apkAssets.length > 0 ? apkAssets : assets;
}

function getReleaseDownloadTotal(release: GitHubRelease): number {
  return getTrackedAssets(release).reduce((total, asset) => {
    return total + (typeof asset.download_count === "number" ? asset.download_count : 0);
  }, 0);
}

function getReleaseDownloadUrl(release: GitHubRelease): string {
  const apkAsset = release.assets?.find((asset) => asset.name.endsWith(".apk"));
  return apkAsset?.browser_download_url ?? getReleasePageUrl(release.tag_name);
}

function getReleasePublishedTimestamp(release: GitHubRelease): number {
  if (!release.published_at) return 0;

  const publishedAt = new Date(release.published_at).getTime();
  return Number.isFinite(publishedAt) ? publishedAt : 0;
}

function getReleaseTitle(release: GitHubRelease): string {
  return release.name?.trim() || release.tag_name;
}

function getChartPeriodStart(period: ChartPeriod, now = Date.now()): number {
  if (period === "all") return 0;
  return now - PERIOD_DAYS[period] * DAY_IN_MS;
}

function getPeriodRangeLabel(period: ChartPeriod): string {
  return period === "all" ? "all time" : `the last ${PERIOD_LABELS[period]}`;
}

function getChartMax(maxValue: number): number {
  if (maxValue <= 1) return 1;

  const magnitude = 10 ** Math.floor(Math.log10(maxValue));
  const normalized = maxValue / magnitude;

  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function getLegacyWebsiteDownloadClicks(): number {
  try {
    const rawCount = window.localStorage.getItem(LEGACY_WEBSITE_DOWNLOAD_CLICK_STORAGE_KEY);
    const parsedCount = Number.parseInt(rawCount ?? "0", 10);
    return Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 0;
  } catch {
    return 0;
  }
}

function getStoredWebsiteDownloadClickTimestamps(): number[] {
  try {
    const rawTimestamps = window.localStorage.getItem(
      WEBSITE_DOWNLOAD_CLICK_TIMESTAMPS_STORAGE_KEY,
    );
    const parsedTimestamps: unknown = JSON.parse(rawTimestamps ?? "[]");
    if (!Array.isArray(parsedTimestamps)) return [];

    return parsedTimestamps
      .map((timestamp) =>
        typeof timestamp === "number" ? timestamp : new Date(String(timestamp)).getTime(),
      )
      .filter((timestamp) => Number.isFinite(timestamp))
      .sort((left, right) => left - right);
  } catch {
    return [];
  }
}

function setStoredWebsiteDownloadClickTimestamps(timestamps: number[]): void {
  try {
    window.localStorage.setItem(
      WEBSITE_DOWNLOAD_CLICK_TIMESTAMPS_STORAGE_KEY,
      JSON.stringify(timestamps),
    );
  } catch {
    // Ignore storage issues and keep the current session responsive.
  }
}

function getWebsiteDownloadClickTotal(): number {
  return (
    getLegacyWebsiteDownloadClicks() + getStoredWebsiteDownloadClickTimestamps().length
  );
}

function renderWebsiteDownloadClicks(count = getWebsiteDownloadClickTotal()): void {
  setTextContent("website-download-count", formatCount(count));
  setTextContent("release-website-total", formatCount(count));
}

function bindDownloadButton(downloadUrl: string): void {
  const downloadBtn = document.getElementById("download-btn") as HTMLButtonElement | null;
  if (!downloadBtn) return;

  downloadBtn.onclick = () => {
    incrementWebsiteDownloadClicks();
    window.open(downloadUrl, "_blank", "noopener");
  };
}

function bindTrackedDownloadLinks(): void {
  const trackedLinks = document.querySelectorAll<HTMLAnchorElement>(
    "[data-track-download='true']",
  );

  trackedLinks.forEach((link) => {
    if (link.dataset.downloadBound === "true") return;

    link.dataset.downloadBound = "true";
    link.addEventListener("click", () => {
      incrementWebsiteDownloadClicks();
    });
  });
}

function getBucketResolution(period: ChartPeriod): BucketResolution {
  if (period === "30d" || period === "90d") return "day";
  if (period === "180d") return "week";
  return "month";
}

function getBucketStart(timestamp: number, resolution: BucketResolution): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);

  if (resolution === "week") {
    const day = date.getDay();
    const daysFromMonday = (day + 6) % 7;
    date.setDate(date.getDate() - daysFromMonday);
  }

  if (resolution === "month") {
    date.setDate(1);
  }

  return date.getTime();
}

function addBucketStep(timestamp: number, resolution: BucketResolution): number {
  const date = new Date(timestamp);

  if (resolution === "day") {
    date.setDate(date.getDate() + 1);
    return date.getTime();
  }

  if (resolution === "week") {
    date.setDate(date.getDate() + 7);
    return date.getTime();
  }

  date.setMonth(date.getMonth() + 1);
  return date.getTime();
}

function formatBucketShortLabel(timestamp: number, resolution: BucketResolution): string {
  if (resolution === "month") {
    return monthDateFormatter.format(timestamp);
  }

  return shortDateFormatter.format(timestamp);
}

function formatBucketDetail(timestamp: number, resolution: BucketResolution): string {
  if (resolution === "week") {
    return `Week of ${fullDateFormatter.format(timestamp)}`;
  }

  if (resolution === "month") {
    return monthDateFormatter.format(timestamp);
  }

  return fullDateFormatter.format(timestamp);
}

function buildWebsiteDownloadTimeline(period: ChartPeriod): TimelineBarPoint[] {
  const timestamps = getStoredWebsiteDownloadClickTimestamps();
  if (timestamps.length === 0) return [];

  const resolution = getBucketResolution(period);
  const now = Date.now();
  const rawStart = period === "all" ? timestamps[0] : getChartPeriodStart(period, now);
  const start = getBucketStart(rawStart, resolution);
  const end = getBucketStart(now, resolution);
  const countsByBucket = new Map<number, number>();

  timestamps
    .filter((timestamp) => timestamp >= rawStart && timestamp <= now)
    .forEach((timestamp) => {
      const bucketStart = getBucketStart(timestamp, resolution);
      countsByBucket.set(
        bucketStart,
        (countsByBucket.get(bucketStart) ?? 0) + 1,
      );
    });

  const points: TimelineBarPoint[] = [];

  for (let cursor = start; cursor <= end; cursor = addBucketStep(cursor, resolution)) {
    const value = countsByBucket.get(cursor) ?? 0;
    points.push({
      detail: formatBucketDetail(cursor, resolution),
      shortLabel: formatBucketShortLabel(cursor, resolution),
      value,
    });
  }

  return points;
}

function getReleasesInPeriod(
  releases: GitHubRelease[],
  period: ChartPeriod,
): GitHubRelease[] {
  const periodStart = getChartPeriodStart(period);

  return releases.filter((release) => {
    if (period === "all") return true;
    return getReleasePublishedTimestamp(release) >= periodStart;
  });
}

function buildGitHubDownloadTimeline(
  releases: GitHubRelease[],
  period: ChartPeriod,
): TimelineBarPoint[] {
  return getReleasesInPeriod(releases, period)
    .filter((release) => getReleasePublishedTimestamp(release) > 0)
    .sort(
      (left, right) =>
        getReleasePublishedTimestamp(left) - getReleasePublishedTimestamp(right),
    )
    .map((release) => {
      const publishedTimestamp = getReleasePublishedTimestamp(release);
      return {
        detail: `${getReleaseTitle(release)} • ${fullDateFormatter.format(
          publishedTimestamp,
        )}`,
        shortLabel: shortDateFormatter.format(publishedTimestamp),
        value: getReleaseDownloadTotal(release),
      };
    });
}

function isMobileChartViewport(): boolean {
  return window.matchMedia("(max-width: 767px)").matches;
}

function getTimelineChartLayout(
  containerWidth: number,
  pointsLength: number,
): TimelineChartLayout {
  const safeContainerWidth = Math.max(containerWidth, 320);
  const safePointCount = Math.max(pointsLength, 1);

  if (isMobileChartViewport()) {
    const paddingLeft = 50;
    const paddingRight = 16;
    const slotWidth =
      safePointCount <= 5 ? 70 : safePointCount <= 10 ? 58 : safePointCount <= 18 ? 50 : 44;
    const chartWidth = Math.max(
      safeContainerWidth,
      paddingLeft + paddingRight + safePointCount * slotWidth,
    );
    const targetLabelCount = Math.min(safePointCount, 8);

    return {
      chartHeight: 300,
      chartWidth,
      emptyMinHeightClass: "min-h-[300px]",
      labelFrequency: Math.max(1, Math.ceil(safePointCount / targetLabelCount)),
      maxBarWidth: 30,
      minBarWidth: 18,
      mode: "mobile",
      paddingBottom: 68,
      paddingLeft,
      paddingRight,
      paddingTop: 18,
      showScrollHint: chartWidth > safeContainerWidth + 24,
      svgClassName: "block h-[300px] w-auto max-w-none",
      xAxisFontSize: 10,
      yAxisFontSize: 10,
    };
  }

  const targetLabelCount = Math.min(safePointCount, 7);

  return {
    chartHeight: 380,
    chartWidth: safeContainerWidth,
    emptyMinHeightClass: "min-h-[340px] md:min-h-[380px]",
    labelFrequency: Math.max(1, Math.ceil(safePointCount / targetLabelCount)),
    maxBarWidth: 52,
    minBarWidth: 14,
    mode: "desktop",
    paddingBottom: 60,
    paddingLeft: 60,
    paddingRight: 20,
    paddingTop: 24,
    showScrollHint: false,
    svgClassName: "block w-full h-auto",
    xAxisFontSize: 11,
    yAxisFontSize: 11,
  };
}

function getTimelineEmptyStateMarkup(containerWidth: number, emptyLabel: string): string {
  const layout = getTimelineChartLayout(containerWidth, 0);

  return `
    <div class="${layout.emptyMinHeightClass} rounded-[1.25rem] border border-dashed border-white/10 bg-black/15 flex items-center justify-center text-center px-6 text-sm text-gray-500">
      ${emptyLabel}
    </div>`;
}

function renderTimelineEmptyState(containerId: string, emptyLabel: string): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = getTimelineEmptyStateMarkup(container.clientWidth, emptyLabel);
}

function renderTimelineChart(
  containerId: string,
  points: TimelineBarPoint[],
  options: {
    accentColor: string;
    emptyLabel: string;
    unitLabel: string;
  },
): void {
  const container = document.getElementById(containerId);
  if (!container) return;

  const containerWidth = Math.max(container.clientWidth, 320);

  if (points.length === 0) {
    container.innerHTML = getTimelineEmptyStateMarkup(containerWidth, options.emptyLabel);
    return;
  }

  const layout = getTimelineChartLayout(containerWidth, points.length);
  const chartWidth = layout.chartWidth;
  const chartHeight = layout.chartHeight;
  const paddingTop = layout.paddingTop;
  const paddingRight = layout.paddingRight;
  const paddingBottom = layout.paddingBottom;
  const paddingLeft = layout.paddingLeft;
  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const chartMax = getChartMax(maxValue);
  const slotWidth = innerWidth / points.length;
  const barWidth = Math.max(
    layout.minBarWidth,
    Math.min(layout.maxBarWidth, slotWidth * (layout.mode === "mobile" ? 0.58 : 0.64)),
  );
  const labelFrequency = layout.labelFrequency;

  const gridLines = Array.from({ length: 5 }, (_, index) => {
    const value = (chartMax / 4) * index;
    const y =
      paddingTop + innerHeight - (value / chartMax) * innerHeight;

    return `
      <g>
        <line x1="${paddingLeft}" y1="${y}" x2="${chartWidth - paddingRight}" y2="${y}" stroke="rgba(255,255,255,0.08)" stroke-width="1" />
        <text x="${paddingLeft - 10}" y="${y + 4}" fill="rgba(156,163,175,0.8)" text-anchor="end" font-size="${layout.yAxisFontSize}">
          ${formatCount(Math.round(value))}
        </text>
      </g>`;
  }).join("");

  const bars = points
    .map((point, index) => {
      const scaledHeight =
        point.value > 0 ? (point.value / chartMax) * innerHeight : 0;
      const displayHeight = point.value > 0 ? scaledHeight : 2;
      const x =
        paddingLeft + index * slotWidth + (slotWidth - barWidth) / 2;
      const y = paddingTop + innerHeight - displayHeight;
      const shouldRenderLabel =
        index % labelFrequency === 0 || index === points.length - 1;

      return `
        <g>
          <title>${escapeHtml(
            `${point.detail}: ${formatCount(point.value)} ${options.unitLabel}`,
          )}</title>
          <rect
            x="${x}"
            y="${y}"
            width="${barWidth}"
            height="${displayHeight}"
            rx="8"
            fill="${options.accentColor}"
            fill-opacity="${point.value > 0 ? 1 : 0.18}"
          />
          ${
            shouldRenderLabel
              ? `
                <text
                  x="${x + barWidth / 2}"
                  y="${chartHeight - 18}"
                  fill="rgba(156,163,175,0.82)"
                  text-anchor="middle"
                  font-size="${layout.xAxisFontSize}"
                >
                  ${escapeHtml(point.shortLabel)}
                </text>`
              : ""
          }
        </g>`;
    })
    .join("");

  const svgMarkup = `
    <svg
      viewBox="0 0 ${chartWidth} ${chartHeight}"
      width="${chartWidth}"
      height="${chartHeight}"
      class="${layout.svgClassName}"
      aria-label="Timeline bar chart"
      role="img"
    >
      ${gridLines}
      ${bars}
    </svg>`;

  container.innerHTML =
    layout.mode === "mobile"
      ? `
        <div class="w-full">
          <div class="w-full overflow-x-auto pb-2 [scrollbar-color:rgba(255,255,255,0.18)_transparent] [scrollbar-width:thin]">
            ${svgMarkup}
          </div>
          ${
            layout.showScrollHint
              ? '<p class="mt-3 text-[10px] font-bold tracking-[0.18em] uppercase text-gray-500 md:hidden">Swipe horizontally to inspect the full timeline</p>'
              : ""
          }
        </div>`
      : svgMarkup;
}

function getTimelineRangeLabel(points: TimelineBarPoint[]): string {
  if (points.length === 0) return "No data";
  if (points.length === 1) return points[0].shortLabel;

  return `${points[0].shortLabel} to ${points[points.length - 1].shortLabel}`;
}

function renderGitHubDownloadCount(releases: GitHubRelease[]): void {
  const totalDownloads = releases.reduce((sum, release) => {
    return sum + getReleaseDownloadTotal(release);
  }, 0);

  setTextContent("github-download-count", formatCount(totalDownloads));
  setTextContent("release-total-downloads", formatCount(totalDownloads));
}

function formatInlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener" class="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">$1</a>',
    )
    .replace(
      /`([^`]+)`/g,
      '<code class="rounded-md bg-white/10 px-1.5 py-0.5 text-[0.92em] text-white">$1</code>',
    )
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-white">$1</strong>');
}

function renderReleaseBody(markdown?: string): string {
  const trimmedMarkdown = markdown?.trim();
  if (!trimmedMarkdown) {
    return `
      <p class="text-gray-500 leading-relaxed">
        No release notes were attached to this release.
      </p>`;
  }

  const lines = trimmedMarkdown.split(/\r?\n/);
  const blocks: string[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;

    blocks.push(`
      <p class="text-gray-300 leading-relaxed">
        ${formatInlineMarkdown(paragraphLines.join(" "))}
      </p>`);
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;

    blocks.push(`
      <ul class="list-disc list-inside space-y-2 text-gray-300 leading-relaxed">
        ${listItems.join("")}
      </ul>`);
    listItems = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      return;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();

      const headingClasses =
        headingMatch[1].length === 1
          ? "text-2xl"
          : headingMatch[1].length === 2
            ? "text-xl"
            : "text-lg";

      blocks.push(`
        <h4 class="${headingClasses} font-semibold tracking-tight text-white">
          ${formatInlineMarkdown(headingMatch[2])}
        </h4>`);
      return;
    }

    const listItemMatch =
      line.match(/^[-*]\s+(.+)$/) ?? line.match(/^\d+\.\s+(.+)$/);
    if (listItemMatch) {
      flushParagraph();
      listItems.push(`<li>${formatInlineMarkdown(listItemMatch[1])}</li>`);
      return;
    }

    paragraphLines.push(line);
  });

  flushParagraph();
  flushList();

  return `<div class="space-y-4">${blocks.join("")}</div>`;
}

function renderReleaseNotesList(releases: GitHubRelease[]): void {
  const list = document.getElementById("release-notes-list");
  if (!list) return;

  const sortedReleases = [...releases].sort(
    (left, right) =>
      getReleasePublishedTimestamp(right) - getReleasePublishedTimestamp(left),
  );

  list.innerHTML = sortedReleases
    .map((release) => {
      const publishedTimestamp = getReleasePublishedTimestamp(release);
      const publishedLabel =
        publishedTimestamp > 0
          ? fullDateFormatter.format(publishedTimestamp)
          : "Unpublished";
      const downloadCount = formatCount(getReleaseDownloadTotal(release));
      const assetCount = formatCount(getTrackedAssets(release).length);
      const releaseType = release.prerelease ? "Prerelease" : "Release";
      const releaseHtmlUrl = release.html_url ?? getReleasePageUrl(release.tag_name);

      return `
        <article class="rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#191919] to-[#111111] p-6 md:p-8 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
          <div class="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div class="max-w-3xl">
              <p class="text-[10px] font-bold tracking-[0.24em] uppercase text-gray-500">
                ${releaseType} • ${publishedLabel}
              </p>
              <h3 class="mt-4 text-2xl md:text-3xl font-bold tracking-tight text-white text-balance">
                ${escapeHtml(getReleaseTitle(release))}
              </h3>

              <div class="mt-4 flex flex-wrap gap-2">
                <span class="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold tracking-[0.18em] uppercase text-gray-300">
                  ${escapeHtml(release.tag_name)}
                </span>
                <span class="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold tracking-[0.18em] uppercase text-gray-300">
                  ${downloadCount} downloads
                </span>
                <span class="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold tracking-[0.18em] uppercase text-gray-300">
                  ${assetCount} assets
                </span>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row gap-3 xl:shrink-0">
              <a
                href="${getReleaseDownloadUrl(release)}"
                target="_blank"
                rel="noopener"
                data-track-download="true"
                class="inline-flex justify-center items-center rounded-xl bg-white text-black px-5 py-3 font-bold hover:bg-gray-200 transition-all active:scale-95"
              >
                Download Build
              </a>
              <a
                href="${releaseHtmlUrl}"
                target="_blank"
                rel="noopener"
                class="inline-flex justify-center items-center rounded-xl border border-white/15 bg-transparent text-white px-5 py-3 font-bold hover:bg-white/5 transition-all active:scale-95"
              >
                View on GitHub
              </a>
            </div>
          </div>

          <div class="mt-6 border-t border-white/10 pt-6">
            ${renderReleaseBody(release.body)}
          </div>
        </article>`;
    })
    .join("");

  bindTrackedDownloadLinks();
}

function updateReleasePeriodButtons(period: ChartPeriod): void {
  const periodButtons = document.querySelectorAll<HTMLButtonElement>(
    "[data-release-period]",
  );

  periodButtons.forEach((button) => {
    const isActive = button.dataset.releasePeriod === period;
    button.classList.toggle("bg-white", isActive);
    button.classList.toggle("text-black", isActive);
    button.classList.toggle("border-white/30", isActive);
    button.classList.toggle("shadow-[0_0_24px_rgba(255,255,255,0.16)]", isActive);
    button.classList.toggle("bg-white/5", !isActive);
    button.classList.toggle("text-gray-400", !isActive);
    button.classList.toggle("border-white/10", !isActive);
  });
}

function renderReleaseNotesAnalytics(
  releases: GitHubRelease[],
  period: ChartPeriod,
): void {
  activeReleasePeriod = period;

  const releasesInPeriod = getReleasesInPeriod(releases, period);
  const releaseDownloadsInPeriod = releasesInPeriod.reduce((sum, release) => {
    return sum + getReleaseDownloadTotal(release);
  }, 0);
  const releaseTimeline = buildGitHubDownloadTimeline(releases, period);
  const websiteTimeline = buildWebsiteDownloadTimeline(period);
  const websiteTimelineTotal = websiteTimeline.reduce((sum, point) => {
    return sum + point.value;
  }, 0);
  const websiteResolution = getBucketResolution(period);

  renderGitHubDownloadCount(releases);
  renderWebsiteDownloadClicks();

  setTextContent("release-period-downloads", formatCount(releaseDownloadsInPeriod));
  setTextContent(
    "release-period-downloads-label",
    `Downloads from releases published across ${getPeriodRangeLabel(period)}.`,
  );
  setTextContent("release-period-release-count", formatCount(releasesInPeriod.length));
  setTextContent(
    "release-period-release-count-label",
    period === "all"
      ? "Published releases currently included in the feed."
      : `Published releases inside ${getPeriodRangeLabel(period)}.`,
  );

  setTextContent(
    "release-downloads-caption",
    releaseTimeline.length > 0
      ? `${formatCount(releaseDownloadsInPeriod)} downloads across ${formatCount(
          releasesInPeriod.length,
        )} release dates in ${getPeriodRangeLabel(period)}.`
      : `No published releases fall inside ${getPeriodRangeLabel(period)}.`,
  );

  setTextContent(
    "website-downloads-caption",
    websiteTimeline.length > 0
      ? `${formatCount(websiteTimelineTotal)} clicks grouped by ${websiteResolution} in ${getPeriodRangeLabel(period)}.`
      : `No local website click history exists in ${getPeriodRangeLabel(period)}.`,
  );

  renderTimelineChart("release-downloads-chart", releaseTimeline, {
    accentColor: "#F8FAFC",
    emptyLabel: `No GitHub release download data is available for ${getPeriodRangeLabel(period)}.`,
    unitLabel: "downloads",
  });
  setTextContent(
    "release-downloads-total",
    `${formatCount(releaseDownloadsInPeriod)} downloads`,
  );
  setTextContent(
    "release-downloads-range",
    getTimelineRangeLabel(releaseTimeline),
  );

  renderTimelineChart("website-downloads-chart", websiteTimeline, {
    accentColor: "#7DD3FC",
    emptyLabel:
      period === "all"
        ? "Website clicks start appearing here once downloads are triggered from this browser."
        : `No website click events were recorded in ${getPeriodRangeLabel(period)}.`,
    unitLabel: "clicks",
  });
  setTextContent(
    "website-downloads-total",
    `${formatCount(websiteTimelineTotal)} clicks`,
  );
  setTextContent(
    "website-downloads-range",
    getTimelineRangeLabel(websiteTimeline),
  );

  updateReleasePeriodButtons(period);
}

async function refreshReleaseNotesAnalyticsIfVisible(): Promise<void> {
  if (!document.getElementById("release-notes-view")) return;

  try {
    const releases = await fetchPublishedReleases();
    renderReleaseNotesAnalytics(releases, activeReleasePeriod);
  } catch {
    // Leave the existing UI intact if release history cannot be refreshed.
  }
}

function ensureReleaseNotesResizeListener(): void {
  if (releaseNotesResizeListenerBound) return;

  window.addEventListener(
    "resize",
    () => {
      window.clearTimeout(releaseNotesResizeTimer);
      releaseNotesResizeTimer = window.setTimeout(() => {
        void refreshReleaseNotesAnalyticsIfVisible();
      }, 120);
    },
    { passive: true },
  );

  releaseNotesResizeListenerBound = true;
}

async function fetchPublishedReleases(): Promise<GitHubRelease[]> {
  if (!releaseCachePromise) {
    releaseCachePromise = (async () => {
      const releases: GitHubRelease[] = [];

      for (let page = 1; page <= MAX_RELEASE_PAGES; page += 1) {
        const res = await fetch(
          `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases?per_page=${RELEASES_PER_PAGE}&page=${page}`,
        );
        if (!res.ok) {
          throw new Error(`GitHub releases request failed with status ${res.status}`);
        }

        const pageReleases: unknown = await res.json();
        if (!Array.isArray(pageReleases) || pageReleases.length === 0) break;

        releases.push(...(pageReleases as GitHubRelease[]));
        if (pageReleases.length < RELEASES_PER_PAGE) break;
      }

      return releases
        .filter((release) => !release.draft)
        .sort(
          (left, right) =>
            getReleasePublishedTimestamp(right) - getReleasePublishedTimestamp(left),
        );
    })();
  }

  try {
    return await releaseCachePromise;
  } catch (error) {
    releaseCachePromise = null;
    throw error;
  }
}

async function fetchRepositoryInfo(): Promise<GitHubRepositoryInfo> {
  if (!repositoryInfoCachePromise) {
    repositoryInfoCachePromise = (async () => {
      const res = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`,
      );
      if (!res.ok) {
        throw new Error(`GitHub repository request failed with status ${res.status}`);
      }

      const repositoryInfo: unknown = await res.json();
      return repositoryInfo as GitHubRepositoryInfo;
    })();
  }

  try {
    return await repositoryInfoCachePromise;
  } catch (error) {
    repositoryInfoCachePromise = null;
    throw error;
  }
}

function incrementWebsiteDownloadClicks(): number {
  const timestamps = getStoredWebsiteDownloadClickTimestamps();
  timestamps.push(Date.now());
  setStoredWebsiteDownloadClickTimestamps(timestamps);

  const nextTotal = getLegacyWebsiteDownloadClicks() + timestamps.length;
  renderWebsiteDownloadClicks(nextTotal);
  void refreshReleaseNotesAnalyticsIfVisible();

  return nextTotal;
}

export async function fetchLatestRelease() {
  renderWebsiteDownloadClicks();
  renderRepositoryStars();
  bindDownloadButton(getReleasePageUrl());
  setTextContent("version-tag", "Latest release on GitHub");

  try {
    const [releases, repositoryInfo] = await Promise.all([
      fetchPublishedReleases(),
      fetchRepositoryInfo().catch(() => null),
    ]);
    if (releases.length === 0) return;

    const latestRelease = releases.find((release) => !release.prerelease) ?? releases[0];

    setTextContent("version-tag", `v${latestRelease.tag_name} • Android APK`);
    renderGitHubDownloadCount(releases);
    renderRepositoryStars(repositoryInfo?.stargazers_count);
    bindDownloadButton(getReleaseDownloadUrl(latestRelease));
  } catch {
    // Silently fail — the fallback release link and local click counter stay active.
  }
}

export async function initReleaseNotesPage() {
  renderWebsiteDownloadClicks();
  renderRepositoryStars();
  updateReleasePeriodButtons(activeReleasePeriod);
  ensureReleaseNotesResizeListener();

  try {
    const [releases, repositoryInfo] = await Promise.all([
      fetchPublishedReleases(),
      fetchRepositoryInfo().catch(() => null),
    ]);
    renderReleaseNotesAnalytics(releases, activeReleasePeriod);
    renderRepositoryStars(repositoryInfo?.stargazers_count);
    renderReleaseNotesList(releases);

    const periodButtons = document.querySelectorAll<HTMLButtonElement>(
      "[data-release-period]",
    );
    periodButtons.forEach((button) => {
      button.onclick = () => {
        const nextPeriod = button.dataset.releasePeriod as ChartPeriod | undefined;
        if (!nextPeriod) return;
        renderReleaseNotesAnalytics(releases, nextPeriod);
      };
    });
  } catch {
    renderTimelineEmptyState(
      "release-downloads-chart",
      "Release history could not be loaded from GitHub.",
    );
    renderTimelineEmptyState(
      "website-downloads-chart",
      "Local click history is still available once downloads are triggered from this browser.",
    );
    setInnerHtml(
      "release-notes-list",
      `
        <div class="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 md:p-8 text-gray-400">
          GitHub release notes could not be loaded right now.
        </div>`,
    );
  }
}

export async function fetchContributors() {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contributors`,
    );
    if (!res.ok) return;
    const contributors = await res.json();
    if (!Array.isArray(contributors)) return;

    const grid = document.getElementById("contributors-grid");
    if (!grid) return;

    grid.innerHTML = contributors
      .map(
        (c: {
          login: string;
          avatar_url: string;
          html_url: string;
          contributions: number;
        }) => `
        <a
          href="${c.html_url}"
          target="_blank"
          rel="noopener"
          class="group flex flex-col items-center p-4 rounded-2xl border border-transparent hover:bg-[#1A1A1A] hover:border-white/5 transition-all duration-300 hover:-translate-y-1 w-28 sm:w-32 shrink-0"
        >
          <div class="relative mb-3">
            <img
              src="${c.avatar_url}&s=80"
              alt="${c.login}"
              class="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover ring-2 ring-white/5 group-hover:ring-white/30 transition-all duration-300 relative z-10"
            />
            <div class="absolute inset-0 rounded-full bg-white/0 group-hover:shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all duration-300 z-0"></div>
          </div>

          <span class="text-xs sm:text-sm font-medium text-gray-400 group-hover:text-white transition-colors truncate w-full text-center tracking-tight">
            ${c.login}
          </span>

          <span class="text-[9px] sm:text-[10px] font-bold text-gray-600 uppercase tracking-widest mt-1 group-hover:text-gray-500 transition-colors">
            ${c.contributions} commits
          </span>
        </a>`,
      )
      .join("");

    const cards = Array.from(grid.children) as HTMLElement[];
    cards.forEach((card) => {
      card.style.opacity = "0";
      card.style.transform = "translateY(20px) scale(0.9)";
    });
    animate(
      cards,
      { opacity: 1, y: 0, scale: 1 },
      {
        duration: 0.5,
        delay: stagger(0.05, { startDelay: 0.1 }),
        ease: [0.22, 1, 0.36, 1],
      },
    );
  } catch {
    // Silently fail
  }
}

export async function fetchLatestCommit() {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits?per_page=1`,
    );
    if (!res.ok) return;
    const commits = await res.json();
    if (!Array.isArray(commits) || commits.length === 0) return;

    const shortSha: string = commits[0].sha.substring(0, 7);

    const navVersionTag = document.getElementById("nav-version-tag");
    if (navVersionTag) {
      navVersionTag.textContent = shortSha;
    }
  } catch {
    // Silently fail — keep the placeholder
  }
}
