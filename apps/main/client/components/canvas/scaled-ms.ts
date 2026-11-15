import { animationClock } from "@/client/components/canvas/animation"

export function scaledMs(milliseconds: number) {
  return milliseconds * animationClock.scale
}
