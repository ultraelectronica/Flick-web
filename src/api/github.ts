import { animate, stagger } from "motion";

const REPO_OWNER = "ultraelectronica";
const REPO_NAME = "Flick";
const RELEASES_PER_PAGE = 100;
const MAX_RELEASE_PAGES = 10;
const WEBSITE_DOWNLOAD_CLICK_STORAGE_KEY = "flick-website-download-clicks";
const numberFormatter = new Intl.NumberFormat("en-US");

interface GitHubReleaseAsset {
  browser_download_url: string;
  download_count?: number;
  name: string;
}

interface GitHubRelease {
  assets?: GitHubReleaseAsset[];
  draft?: boolean;
  prerelease?: boolean;
  tag_name: string;
}

function formatCount(value: number): string {
  return numberFormatter.format(value);
}

function setTextContent(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
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

function renderWebsiteDownloadClicks(count = getWebsiteDownloadClicks()): void {
  setTextContent("website-download-count", formatCount(count));
}

function getWebsiteDownloadClicks(): number {
  try {
    const rawCount = window.localStorage.getItem(WEBSITE_DOWNLOAD_CLICK_STORAGE_KEY);
    const parsedCount = Number.parseInt(rawCount ?? "0", 10);
    return Number.isFinite(parsedCount) && parsedCount > 0 ? parsedCount : 0;
  } catch {
    return 0;
  }
}

function incrementWebsiteDownloadClicks(): number {
  const nextCount = getWebsiteDownloadClicks() + 1;

  try {
    window.localStorage.setItem(WEBSITE_DOWNLOAD_CLICK_STORAGE_KEY, String(nextCount));
  } catch {
    // Ignore storage issues and keep the in-memory update for the current render.
  }

  renderWebsiteDownloadClicks(nextCount);
  return nextCount;
}

function bindDownloadButton(downloadUrl: string): void {
  const downloadBtn = document.getElementById("download-btn") as HTMLButtonElement | null;
  if (!downloadBtn) return;

  downloadBtn.onclick = () => {
    incrementWebsiteDownloadClicks();
    window.open(downloadUrl, "_blank", "noopener");
  };
}

function renderGitHubDownloadCount(releases: GitHubRelease[]): void {
  const totalDownloads = releases.reduce((releaseTotal, release) => {
    return (
      releaseTotal +
      getTrackedAssets(release).reduce((assetTotal, asset) => {
        return assetTotal + (typeof asset.download_count === "number" ? asset.download_count : 0);
      }, 0)
    );
  }, 0);

  setTextContent("github-download-count", formatCount(totalDownloads));
}

async function fetchPublishedReleases(): Promise<GitHubRelease[]> {
  const releases: GitHubRelease[] = [];

  for (let page = 1; page <= MAX_RELEASE_PAGES; page += 1) {
    const res = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases?per_page=${RELEASES_PER_PAGE}&page=${page}`,
    );
    if (!res.ok) break;

    const pageReleases: unknown = await res.json();
    if (!Array.isArray(pageReleases) || pageReleases.length === 0) break;

    releases.push(...(pageReleases as GitHubRelease[]));
    if (pageReleases.length < RELEASES_PER_PAGE) break;
  }

  return releases.filter((release) => !release.draft);
}

export async function fetchLatestRelease() {
  renderWebsiteDownloadClicks();
  bindDownloadButton(getReleasePageUrl());
  setTextContent("version-tag", "Latest release on GitHub");

  try {
    const releases = await fetchPublishedReleases();
    if (releases.length === 0) return;

    const latestRelease =
      releases.find((release) => !release.prerelease) ?? releases[0];
    const apkAsset = latestRelease.assets?.find((asset) =>
      asset.name.endsWith(".apk"),
    );
    const downloadUrl =
      apkAsset?.browser_download_url ?? getReleasePageUrl(latestRelease.tag_name);

    setTextContent("version-tag", `v${latestRelease.tag_name} • Android APK`);
    setTextContent("github-download-count", "--");
    renderGitHubDownloadCount(releases);
    bindDownloadButton(downloadUrl);
  } catch {
    // Silently fail — the fallback release link and local click counter stay active.
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
      { duration: 0.5, delay: stagger(0.05, { startDelay: 0.1 }), ease: [0.22, 1, 0.36, 1] },
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
