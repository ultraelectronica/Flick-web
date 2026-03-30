export function DownloadStats(): string {
  return `
<div
  id="download-stats"
  class="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-x-8 sm:gap-y-7 max-w-3xl"
>
  <div class="xl:border-l xl:border-white/10 xl:pl-8 xl:first:border-l-0 xl:first:pl-0">
    <p class="text-[10px] font-bold tracking-[0.24em] uppercase text-gray-500 mb-2">
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

  <div class="xl:border-l xl:border-white/10 xl:pl-8 xl:first:border-l-0 xl:first:pl-0">
    <p class="text-[10px] font-bold tracking-[0.24em] uppercase text-gray-500 mb-2">
      GitHub Stars
    </p>
    <p
      id="repo-star-count"
      class="text-3xl sm:text-[2rem] font-bold tracking-tight text-white"
    >
      --
    </p>
    <p class="text-sm text-gray-400 leading-relaxed mt-2">
      Live stargazer total from the Flick repository.
    </p>
  </div>

  <div class="xl:border-l xl:border-white/10 xl:pl-8 xl:first:border-l-0 xl:first:pl-0">
    <p class="text-[10px] font-bold tracking-[0.24em] uppercase text-gray-500 mb-2">
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
