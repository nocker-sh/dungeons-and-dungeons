import type { OverlayMode } from "@/client/components/game/overlay"

export function modeOf(back: "free" | "bag"): OverlayMode {
  return back === "bag" ? { kind: "bag", closing: false } : { kind: "free" }
}
