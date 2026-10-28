import { frame, cancelFrame } from "motion"
import { tween } from "@/client/components/canvas/tween"
import type { Playback } from "@/client/components/canvas/animation"
import { animationTiming } from "@/client/components/stage/timing"
import { stillClock } from "@/client/components/canvas/animation"
import { pickOne } from "@/client/components/stage/pick-one"

export type Shot = { x: number; y: number; z: number; r: number; blur: number }
type Layer = { depth: number; el: HTMLElement }

export const ease = {
  out: (t: number) => 1 - Math.pow(1 - t, 4),
  in: (t: number) => t * t * t * t,
  inOut: (t: number) =>
    t < 0.5 ? 8 * t ** 4 : 1 - Math.pow(-2 * t + 2, 4) / 2,
  soft: (t: number) => 1 - Math.pow(1 - t, 3),
}

/**
 * 奥行きのある層を一台のカメラで撮る。x,y は被写体面での移動量、z はズーム、r はロール。
 * 層は depth に応じて動き、手持ちカメラのように揺れ続ける。
 */
export class Camera {
  readonly cam: Shot = { x: 0, y: 0, z: 1, r: 0, blur: 0 }
  #layers = new Set<Layer>()
  #wobble = 0
  #move?: Playback
  #mouse = { x: 0, y: 0, sx: 0, sy: 0 }
  #t0 = performance.now()

  start() {
    const move = (event: PointerEvent) => {
      this.#mouse.x = event.clientX / innerWidth - 0.5
      this.#mouse.y = event.clientY / innerHeight - 0.5
    }
    addEventListener("pointermove", move)
    const render = ({ timestamp }: { timestamp: number }) =>
      this.#render(timestamp)
    frame.render(render, true)
    return () => {
      cancelFrame(render)
      this.#move?.cancel()
      removeEventListener("pointermove", move)
    }
  }

  add(el: HTMLElement, depth: number) {
    const layer = { el, depth }
    this.#layers.add(layer)
    return () => {
      this.#layers.delete(layer)
    }
  }

  #render(now: number) {
    // 止めている間は揺れの時刻を 0 に固定する（見た目の撮り比べを安定させる）
    const t = stillClock.on ? 0 : (now - this.#t0) / 1000
    const mouse = this.#mouse
    mouse.sx += (mouse.x - mouse.sx) * 0.06
    mouse.sy += (mouse.y - mouse.sy) * 0.06
    const hand = 1 + this.#wobble
    const dx =
      hand *
        (Math.sin(t * 0.23) * 14 +
          Math.sin(t * 1.7) * 3 +
          Math.sin(t * 3.1) * 1.2) +
      mouse.sx * 70
    const dy =
      hand *
        (Math.sin(t * 0.17) * 7 +
          Math.sin(t * 1.3 + 1) * 2.4 +
          Math.sin(t * 2.9) * 1) +
      mouse.sy * 36
    const dr = hand * (Math.sin(t * 0.11) * 0.3 + Math.sin(t * 0.9) * 0.12)
    this.#wobble *= 0.985
    const cam = this.cam
    for (const { el, depth: d } of this.#layers) {
      const s = 1 + (cam.z - 1) * d
      el.style.transform = `translate(${-(cam.x + dx) * d}px, ${-(cam.y + dy) * d}px) scale(${s}) rotate(${(cam.r + dr) * Math.min(1, d + 0.3)}deg)`
      el.style.filter = cam.blur ? `blur(${cam.blur * d}px)` : ""
    }
  }

  /** 目標へ動かす。新しい指示が来たら前の動きは捨てる。 */
  to(target: Partial<Shot>, ms = 1000, fn = ease.inOut) {
    this.#move?.cancel()
    const from = { ...this.cam }
    this.#move = tween(
      0,
      1,
      ms,
      (progress) => {
        for (const key of Object.keys(target) as (keyof Shot)[])
          this.cam[key] = from[key] + (target[key]! - from[key]) * progress
      },
      { ease: fn }
    )
    return this.#move
  }

  cut(target: Partial<Shot>) {
    this.#move?.cancel()
    Object.assign(this.cam, target)
  }

  shake(boost: number) {
    this.#wobble = boost
  }

  /**
   * 映画の入りのショット：少しずれた位置・角度から撮り始め、ぐらつきながら正面に落ち着く。
   * crane（上から降りる）/ dolly（奥へ寄る）/ pan（横から振り込む）/ tilt（下から見上げて起こす）
   */
  establish(
    kind: "crane" | "dolly" | "pan" | "tilt" = pickOne([
      "crane",
      "dolly",
      "pan",
      "tilt",
    ] as const),
    ms = animationTiming.arrival
  ) {
    const side = Math.random() < 0.5 ? -1 : 1
    const from = {
      crane: { x: side * 90, y: -200, z: 1.28, r: side * -2.5, blur: 6 },
      dolly: { x: side * 60, y: 30, z: 1.45, r: side * 2, blur: 8 },
      pan: { x: side * 360, y: -20, z: 1.18, r: side * 3, blur: 10 },
      tilt: { x: side * 40, y: 180, z: 1.25, r: side * -3, blur: 6 },
    }[kind]
    this.cut(from)
    this.#wobble = 1.4
    return this.to({ x: 0, y: 0, z: 1, r: 0, blur: 0 }, ms, ease.soft)
  }
}
