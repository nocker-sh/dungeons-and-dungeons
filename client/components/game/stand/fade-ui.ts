import { play } from "@/client/components/canvas/play"

export function fadeUi(view: HTMLElement | null, to: number, ms: number) {
  for (const el of view?.querySelectorAll<HTMLElement>(
    "[data-screen-content] > .ui-layer"
  ) ?? [])
    play(el, [{ opacity: to ? 0 : 1 }, { opacity: to }], {
      duration: ms,
      fill: "both",
    })
}
