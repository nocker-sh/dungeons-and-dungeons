import type { OverlayState } from "@/client/components/game/overlay"

export function initialOverlay(
  start: { bag?: boolean; lifted?: string | null } = {}
): OverlayState {
  return {
    mode: start.bag ? { kind: "bag", closing: false } : { kind: "free" },
    lifted: start.bag ? null : (start.lifted ?? null),
    closeRequests: 0,
  }
}
