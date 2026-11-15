import { animationTiming } from "@/client/components/stage/timing"
import { MOTION_EASE } from "@/client/components/stage/kit"
import { seconds } from "@/client/components/stage/seconds"

export type FlyOptions = {
  from?: "left" | "right"
  rotate?: number
  delay?: number
  leaveDelay?: number
}

/**
 * 画面外から勢いよく入り、行き過ぎて戻る／吸い込まれるように画面外へ。
 * モックの word()/plate() と clearUI() の動き。motion の initial・animate・exit に渡す形で返す。
 */
export function flyMotion({
  from = "right",
  rotate = 0,
  delay = 0,
  leaveDelay = 0,
}: FlyOptions = {}) {
  const side = from === "right" ? 1 : -1
  const enter = {
    x: [`${130 * side}vw`, `${-2 * side}vw`, "0vw"],
    rotate: [rotate + 25 * side, rotate - 1, rotate],
    transition: {
      duration: seconds(animationTiming.enter),
      delay: seconds(delay),
      times: [0, 0.7, 1],
      ease: MOTION_EASE.out,
    },
  }
  const leave = {
    x: `${from === "left" ? -130 : 130}vw`,
    rotate: rotate + 25,
    transition: {
      duration: seconds(animationTiming.exit),
      delay: seconds(leaveDelay),
      ease: MOTION_EASE.in,
    },
  }
  return {
    initial: { x: enter.x[0], rotate: enter.rotate[0] },
    enter,
    leave,
  }
}
