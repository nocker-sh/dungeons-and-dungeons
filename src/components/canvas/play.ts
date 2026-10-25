import { animate } from "motion/mini"
import { steps } from "motion"
import { playback, scaledMs, type Playback } from "./animation"

/**
 * 命令的な演出（順に待って次へ進む動き）の入口。中身は motion の animate（ブラウザ標準のアニメーション）。
 *
 * 呼び出しは Element.animate と同じ形（キーフレームの配列、ミリ秒）で書ける。
 * - fill を付けなければ、終わった後に元の style へ戻す（Element.animate と同じ）
 * - fill を付ければ、最後の形のまま残す
 * - 戻り値の finished / cancel は Element.animate と同じように使える
 */
export type Frame = Keyframe

export type PlayOptions = {
  duration?: number
  delay?: number
  easing?: string
  fill?: FillMode
  iterations?: number
  direction?: PlaybackDirection
  /** 同じ要素・同じ id の動きは、新しいものを始めると前のものを止める。 */
  id?: string
}

export type Played = Playback

type Ease =
  | string
  | readonly [number, number, number, number]
  | ((t: number) => number)

const NAMED: Record<string, Ease> = {
  linear: "linear",
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
}

/** CSS の書き方のイージングを motion の書き方へ。 */
function toEase(easing: string | undefined): Ease {
  if (!easing) return "linear"
  const named = NAMED[easing]
  if (named) return named
  const bezier = easing.match(/^cubic-bezier\(([^)]+)\)$/)
  if (bezier) {
    const [a, b, c, d] = bezier[1].split(",").map(Number)
    return [a, b, c, d]
  }
  const step = easing.match(/^steps\((\d+)(?:,\s*(\w+))?\)$/)
  if (step)
    return steps(
      Number(step[1]),
      step[2] === "start" || step[2] === "jump-start" ? "start" : "end"
    )
  return "linear"
}

/** offset の無いキーフレームに、Element.animate と同じ規則で位置を配る。 */
function offsets(frames: readonly Frame[]) {
  const result = frames.map((frame) => frame.offset)
  if (result[0] === undefined) result[0] = frames.length > 1 ? 0 : 1
  if (result[result.length - 1] === undefined) result[result.length - 1] = 1
  let start = 0
  for (let i = 1; i < result.length; i++) {
    if (result[i] === undefined) continue
    const from = result[start]!
    const to = result[i]!
    for (let k = start + 1; k < i; k++)
      result[k] = from + ((to - from) * (k - start)) / (i - start)
    start = i
  }
  return result as number[]
}

const SKIP = new Set(["offset", "easing", "composite"])

/** カメラ用の名前（camelCase）を CSS の名前（kebab-case）へ。 */
function cssName(property: string) {
  return property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
}

export function play(
  element: Element | null | undefined,
  frames: readonly Frame[],
  options: PlayOptions | number = {}
): Played {
  if (
    !element ||
    !(element instanceof HTMLElement || element instanceof SVGElement)
  )
    return playback(Promise.resolve(), () => {})
  // 非表示・取り外し済みの要素は再生対象にしない。Motionの置換時commitStylesも防ぐ。
  if (!element.isConnected || element.getClientRects().length === 0) {
    cancelAnimationsWithin(element)
    return playback(Promise.resolve(), () => {})
  }
  const settings: PlayOptions =
    typeof options === "number" ? { duration: options } : options
  const at = offsets(frames)
  const properties = [
    ...new Set(frames.flatMap((frame) => Object.keys(frame))),
  ].filter((key) => !SKIP.has(key))
  const running = active.get(element) ?? new Map<string, Played>()
  active.set(element, running)
  // Motionが同じプロパティの古い再生を黙って止める前に、所有者へ中断を通知する。
  for (const property of properties) running.get(property)?.cancel()
  if (settings.id) running.get(`id:${settings.id}`)?.cancel()
  // 前の再生を取り消すと forget が登録を外す。新しい再生の所有を戻し、
  // 次の置換でもキャンセルと完了待ちの解放が確実に届くようにする。
  active.set(element, running)
  const style = element.style
  // 元に戻すために、動かす前の style を覚えておく
  const before = new Map(
    properties.map((property) => [
      property,
      style.getPropertyValue(cssName(property)),
    ])
  )
  const computed = getComputedStyle(element)
  const keyframes: Record<string, (string | number | null)[]> = {}
  const transitions: Record<string, object> = {}
  for (const property of properties) {
    const values: (string | number | null)[] = []
    const times: number[] = []
    const eases: Ease[] = []
    for (const [i, frame] of [...frames].entries()) {
      const value = frame[property]
      if (value === undefined) continue
      values.push(value)
      times.push(at[i])
      eases.push(toEase(frame.easing ?? settings.easing))
    }
    // 最初や最後に値が無ければ、今の値から・今の値へ（Element.animate の暗黙のキーフレーム）
    if (times[0] > 0) {
      values.unshift(null)
      times.unshift(0)
      eases.unshift(toEase(settings.easing))
    }
    if (times[times.length - 1] < 1) {
      values.push(computed.getPropertyValue(cssName(property)))
      times.push(1)
    }
    if (values.length === 1) values.unshift(null)
    keyframes[property] = values
    transitions[property] = {
      // Motionの個別設定は明示しない限り共通の時間・遅延・繰り返しを引き継がない。
      inherit: true,
      times: values.length === times.length ? times : undefined,
      ease: eases.length > 1 ? eases.slice(0, values.length - 1) : eases[0],
    }
  }
  const repeat =
    settings.iterations === undefined || settings.iterations === 1
      ? 0
      : settings.iterations === Infinity
        ? Infinity
        : settings.iterations - 1
  const controls = animate(
    element,
    keyframes as never,
    {
      duration: scaledMs(settings.duration ?? 0) / 1000,
      delay: scaledMs(settings.delay ?? 0) / 1000,
      repeat,
      repeatType: settings.direction === "alternate" ? "reverse" : "loop",
      ...transitions,
    } as never
  )
  const keep = settings.fill === "forwards" || settings.fill === "both"
  const restore = () => {
    for (const [property, value] of before)
      if (value) style.setProperty(cssName(property), value)
      else style.removeProperty(cssName(property))
  }
  const keys = settings.id ? [...properties, `id:${settings.id}`] : properties
  const forget = () => {
    for (const key of keys) if (running.get(key) === played) running.delete(key)
    if (!running.size) active.delete(element)
  }
  const played = playback(
    controls.finished,
    () => {
      controls.cancel()
      restore()
      forget()
    },
    {
      infinite: repeat === Infinity,
      complete: () => {
        if (!keep) restore()
        // fillの姿もスコープが所有する。中断時に復元できるよう登録を保持する。
        if (!keep) forget()
      },
    }
  )
  for (const key of keys) running.set(key, played)
  return played
}

const active = new Map<Element, Map<string, Played>>()

/** DOMから外れた要素のループ・遅延・完了後のスタイル所有を片付ける。 */
export function cancelDetachedAnimations() {
  for (const [element, tasks] of active) {
    if (element.isConnected) continue
    for (const task of new Set(tasks.values())) task.cancel()
    active.delete(element)
  }
}

export function cancelAnimationsWithin(root: Element) {
  for (const [element, tasks] of active) {
    if (element !== root && !root.contains(element)) continue
    for (const task of new Set(tasks.values())) task.cancel()
    active.delete(element)
  }
}
