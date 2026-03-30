export function DownloadStats(): string {
  return `
<div
  id="download-stats"
  class="mt-8 lg:mt-10 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 max-w-4xl 
         bg-[#101010]/60 backdrop-blur-md border border-white/10 p-6 lg:p-8 rounded-2xl lg:rounded-3xl"
>
  <div class="flex flex-col">
    <p class="min-h-[2.5rem] text-[10px] font-bold tracking-[0.24em] uppercase text-gray-500 mb-2 drop-shadow-md">
      GitHub Release Downloads
    </p>
    <p
      id="github-download-count"
      class="text-3xl sm:text-[2rem] font-bold tracking-tight text-white drop-shadow-lg"
    >
      --
    </p>
    <p class="text-sm text-gray-400 leading-relaxed mt-2 drop-shadow-md">
      Summed from APK assets across published GitHub releases.
    </p>
  </div>

  <div class="flex flex-col">
    <p class="min-h-[2.5rem] text-[10px] font-bold tracking-[0.24em] uppercase text-gray-500 mb-2 drop-shadow-md">
      GitHub Stars
    </p>
    <p
      id="repo-star-count"
      class="text-3xl sm:text-[2rem] font-bold tracking-tight text-white drop-shadow-lg"
    >
      --
    </p>
    <p class="text-sm text-gray-400 leading-relaxed mt-2 drop-shadow-md">
      Live stargazer total from the Flick repository.
    </p>
  </div>

  <div class="flex flex-col">
    <p class="min-h-[2.5rem] text-[10px] font-bold tracking-[0.24em] uppercase text-gray-500 mb-2 drop-shadow-md">
      Website Download Clicks
    </p>
    <p
      id="website-download-count"
      class="text-3xl sm:text-[2rem] font-bold tracking-tight text-white drop-shadow-lg"
    >
      0
    </p>
    <p class="text-sm text-gray-400 leading-relaxed mt-2 drop-shadow-md">
      Tracked from the download button in this browser.
    </p>
  </div>
</div>`;
}
