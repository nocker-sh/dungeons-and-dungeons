import type { StudioInspection } from "@/client/dev/studio-types"

/** 表示中の配置を読み取る。時計やゲーム状態を変更しない。 */
export function inspectStudioElements(): StudioInspection["elements"] {
  return [
    ...document.querySelectorAll<HTMLElement>(
      ".game [aria-label], .game button, .game img"
    ),
  ]
    .filter((element) => element.closest("[data-studio-guide]") === null)
    .map((element) => {
      const rect = element.getBoundingClientRect()
      return {
        tag: element.tagName.toLowerCase(),
        filter: getComputedStyle(element).filter,
        opacity: getComputedStyle(element).opacity,
        image: element.getAttribute("src"),
        label:
          element.getAttribute("aria-label") ??
          element.getAttribute("alt") ??
          element.textContent?.slice(0, 60) ??
          "",
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        outside:
          rect.x < -1 ||
          rect.y < -1 ||
          rect.right > innerWidth + 1 ||
          rect.bottom > innerHeight + 1,
      }
    })
    .filter((entry) => entry.width > 0 && entry.height > 0)
}
