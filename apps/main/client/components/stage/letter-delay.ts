import { animationTiming } from "@/client/components/stage/timing"

/** 文字数が増えても、最後の一文字を待つ時間は増え続けない。 */
export function letterDelay(index: number, length: number) {
  return length <= 1
    ? 0
    : index * Math.min(35, animationTiming.letterSpread / (length - 1))
}
