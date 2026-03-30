export function DownloadStats(): string {
  return `
<div
  id="download-stats"
  class="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-2xl"
>
  <div class="rounded-[1.5rem] border border-white/10 bg-white/5 backdrop-blur-xl px-4 py-4 sm:px-5 sm:py-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
    <p class="text-[10px] font-bold tracking-[0.24em] uppercase text-gray-500 mb-3">
      GitHub Release Downloads
    </p>
    <p
      id="github-download-count"
      class="text-3xl sm:text-[2rem] font-bold tracking-tight text-white"
    >
      --
    </p>
    <p class="text-sm text-gray-400 leading-relaxed mt-2">
      Summed from APK assets across published GitHub releases.
    </p>
  </div>

  <div class="rounded-[1.5rem] border border-white/10 bg-[#161616]/85 backdrop-blur-xl px-4 py-4 sm:px-5 sm:py-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
    <p class="text-[10px] font-bold tracking-[0.24em] uppercase text-gray-500 mb-3">
      Website Download Clicks
    </p>
    <p
      id="website-download-count"
      class="text-3xl sm:text-[2rem] font-bold tracking-tight text-white"
    >
      0
    </p>
    <p class="text-sm text-gray-400 leading-relaxed mt-2">
      Tracked from the download button in this browser.
    </p>
  </div>
</div>`;
}
