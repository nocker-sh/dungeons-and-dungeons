import { AnimationAborted } from "@/client/components/canvas/animation"

/** 中断は通常終了。その他の失敗は隠さない。 */
export function reportAnimationError(error: unknown) {
  if (!(error instanceof AnimationAborted)) throw error
}
