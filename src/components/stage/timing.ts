/** ゲームとプレビュー共通の演出定義。単位はms。実行順はMotionの完了通知で制御する。 */
export const animationTiming = {
  feedback: 100,
  change: 180,
  enter: 420,
  exit: 240,
  stagger: 60,
  letter: 280,
  letterStart: 100,
  letterSpread: 180,
  arrival: 450,
  /** 行き先を選んで背景のその場所へ寄る。 */
  focus: 420,
  opening: 700,
  cutIn: 800,
  special: 760,
  number: 720,
  damage: 560,
  impact: 80,
  hp: 180,
  knockout: 240,
  resultPause: 60,
  foeWindup: 160,
  skillLabel: 240,
  nextFoe: 180,
  encounterLead: 360,
  encounterSettle: 120,
  milestone: 1100,
} as const

/** 文字数が増えても、最後の一文字を待つ時間は増え続けない。 */
export function letterDelay(index: number, length: number) {
  return length <= 1
    ? 0
    : index * Math.min(35, animationTiming.letterSpread / (length - 1))
}

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
