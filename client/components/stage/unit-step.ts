/**
 * 文字と部品の大きさの単位（px）の段。画面の短い辺の1%を、この段の中から選ぶ。
 * 連続に変えると、画面を少し広げただけで文字の折り返しや重なりが変わって崩れるので、段ごとに切り替える。
 * 段は3つだけにし、一番上の段で止める。大きな画面でも文字と部品が大きくなりすぎないようにする。
 * スマホ（短い辺が360〜460px）は3.6、タブレットや低い窓は4.6、それより大きい画面は5.6。
 */
export const UNIT_STEPS = [3.6, 4.6, 5.6] as const

/** 画面の大きさに合う単位の段（px）。短い辺の1%を超えない一番大きな段。 */
export function unitStep(width: number, height: number) {
  const raw = Math.min(width, height) / 100
  let step: number = UNIT_STEPS[0]
  for (const candidate of UNIT_STEPS) if (candidate <= raw) step = candidate
  return step
}
