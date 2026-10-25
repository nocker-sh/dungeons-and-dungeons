import { AnimationAborted, tween } from "@/components/canvas/animation"
export {
  scaledMs,
  setTimeScale,
  stillClock,
} from "@/components/canvas/animation"
import { scaledMs } from "@/components/canvas/animation"
/** 演出で使う色・イージング・小道具。見た目の乱数はゲームの規則に関わらないので Math.random でよい。 */
export const COLOR = {
  ink: "#0b0c12",
  night: "#12141c",
  deep: "#1b2030",
  moss: "#7fa58a",
  sage: "#c3dbc8",
  amethyst: "#4a3d78",
  lavender: "#aa9fd4",
  dusk: "#4f6c9e",
  mist: "#dcdee5",
  stone: "#858995",
  paper: "#eeebe3",
  blood: "#6b1723",
} as const

export const EASE_OUT = "cubic-bezier(.16,1,.3,1)"
export const EASE_IN = "cubic-bezier(.7,0,.84,0)"
export const EASE_POP = "cubic-bezier(.34,1.56,.64,1)"

/** motion 用の同じ曲線（3次ベジェの4つの値）。 */
export const MOTION_EASE = {
  out: [0.16, 1, 0.3, 1],
  in: [0.7, 0, 0.84, 0],
  pop: [0.34, 1.56, 0.64, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>

/** motion の秒。演出の待ち時間の倍率（プレビューの早送り）もかける。 */
export function seconds(ms: number) {
  return scaledMs(ms) / 1000
}

export const randomBetween = (a: number, b: number) =>
  a + Math.random() * (b - a)
export const pickOne = <T>(list: readonly T[]) =>
  list[Math.floor(Math.random() * list.length)]

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

/** いまの単位（px）。Canvas の --u と同じ値。 */
export const unitPx = () => unitStep(innerWidth, innerHeight)

export function isAborted(error: unknown) {
  return error instanceof AnimationAborted
}

/** 要素の中心を view 基準の座標で返す。 */
export function centerOf(el: Element | null, view: Element | null, fy = 0.5) {
  if (!el || !view) return { x: 0, y: 0, w: 0, h: 0 }
  const r = el.getBoundingClientRect()
  const v = view.getBoundingClientRect()
  return {
    x: r.left - v.left + r.width / 2,
    y: r.top - v.top + r.height * fy,
    w: r.width,
    h: r.height,
  }
}

/** 7つの頂点を大きく揺らし、どの辺も平行にならない形。 */
export function brokenShape() {
  const j = (a: number, b: number) => randomBetween(a, b).toFixed(1)
  return {
    sp: `polygon(${j(0, 10)}% ${j(12, 42)}%, ${j(28, 52)}% ${j(-10, 6)}%, ${j(86, 98)}% ${j(14, 40)}%, ${j(98, 112)}% ${j(58, 80)}%, ${j(70, 88)}% ${j(100, 114)}%, ${j(18, 40)}% ${j(86, 100)}%, ${j(-10, 3)}% ${j(66, 92)}%)`,
    sl: `${j(-12, -2)}%`,
    sr: `${j(-18, -6)}%`,
    st: `${j(8, 24)}%`,
    sb: `${j(-26, -12)}%`,
  }
}

/** 数字を数え上げる。毎フレーム React を再描画しないよう、要素へ直接書く。 */
export function countUp(
  el: HTMLElement | null,
  from: number,
  to: number,
  ms: number
) {
  if (el) el.textContent = String(from)
  return tween(
    from,
    to,
    ms,
    (value) => {
      if (el) el.textContent = String(Math.round(value))
    },
    { ease: (value) => 1 - Math.pow(1 - value, 3) }
  )
}
