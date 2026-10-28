import { animationTiming } from "@/client/components/stage/timing"

/** 通常速度のQAで使う時間の契約。実行時の完了判定には使わない。 */
export function battleResultTiming(
  targets: number,
  numberDelay = 0,
  /**
   * 相手の見せ方。既定は味方のようにHPを数え直し、倒れて退場する場合まで含めた上限。
   * 敵はHPを出さないので hp: false、倒れないなら knockout: false にする。
   */
  shown: { hp?: boolean; knockout?: boolean } = {}
) {
  const { hp = true, knockout = true } = shown
  const hpAt = animationTiming.impact + animationTiming.damage
  const settled = Math.max(
    animationTiming.number,
    // 被害の数字は当たってから出て、表示し終えるまで待つ
    animationTiming.impact + animationTiming.number,
    hp ? hpAt + animationTiming.hp : 0,
    knockout ? hpAt + animationTiming.knockout : 0,
    numberDelay + animationTiming.number
  )
  return {
    hpAt,
    duration:
      settled +
      Math.max(0, targets - 1) * animationTiming.stagger +
      animationTiming.resultPause,
  }
}
