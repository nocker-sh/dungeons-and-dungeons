import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import { stillClock } from "@/client/components/canvas/animation"
import { animationTiming } from "@/client/components/stage/timing"
import { FOCUS_SCALE, focusShot } from "@/client/components/stage/focus-shot"
import { focusMove } from "@/client/components/stage/focus-move"
import { layerPointOf } from "@/client/components/stage/layer-point-of"
import type { FocusFrame } from "@/client/components/stage/focus-zoom"

// 縦長のスマホ。背景の面は画面より 7% ずつ広い（stage.tsx の ArtSet）
const frame: FocusFrame = {
  layerLeft: -27.3,
  layerTop: -50,
  layerWidth: 444.6,
  layerHeight: 814,
  viewportWidth: 390,
  viewportHeight: 714,
}
const depth = 0.5

/** stage の層と同じ変形（translate(-cam*depth) scale(1+(z-1)*depth)、中心は 50% 55%）。 */
function project(
  point: { x: number; y: number },
  shot: { x: number; y: number; z: number }
) {
  const scale = 1 + (shot.z - 1) * depth
  const originX = frame.layerLeft + frame.layerWidth * 0.5
  const originY = frame.layerTop + frame.layerHeight * 0.55
  return {
    x: originX - shot.x * depth + scale * (point.x - frame.layerWidth * 0.5),
    y: originY - shot.y * depth + scale * (point.y - frame.layerHeight * 0.55),
  }
}

describe("行き先へ寄るカメラ", () => {
  afterEach(() => {
    stillClock.on = false
    vi.unstubAllGlobals()
  })

  it("背景の点を画面の中央へ運び、背景の面を約2.2倍にする", () => {
    const point = { x: 230, y: 420 }
    const shot = focusShot(point, frame)
    const landed = project(point, shot)
    expect(landed.x).toBeCloseTo(frame.viewportWidth / 2)
    expect(landed.y).toBeCloseTo(frame.viewportHeight / 2)
    expect(1 + (shot.z - 1) * depth).toBeCloseTo(FOCUS_SCALE)
    expect(shot.r).toBe(0)
  })

  it("端の行き先でも、寄った画面に背景の外を映さない", () => {
    for (const point of [
      { x: 0, y: 0 },
      { x: frame.layerWidth, y: frame.layerHeight },
      { x: frame.layerWidth * 0.95, y: frame.layerHeight * 0.1 },
    ]) {
      const shot = focusShot(point, frame)
      const topLeft = project({ x: 0, y: 0 }, shot)
      const bottomRight = project(
        { x: frame.layerWidth, y: frame.layerHeight },
        shot
      )
      expect(topLeft.x).toBeLessThanOrEqual(0)
      expect(topLeft.y).toBeLessThanOrEqual(0)
      expect(bottomRight.x).toBeGreaterThanOrEqual(frame.viewportWidth)
      expect(bottomRight.y).toBeGreaterThanOrEqual(frame.viewportHeight)
    }
  })

  it("画面上の位置から、今のカメラを戻して背景の点を求める", () => {
    const camera = { x: 40, y: -30, z: 1.2 }
    const point = { x: 120, y: 500 }
    const view = project(point, camera)
    const back = layerPointOf(view, frame, camera)
    expect(back.x).toBeCloseTo(point.x)
    expect(back.y).toBeCloseTo(point.y)
  })

  it("背景へ寄ってから、寄る動きの続きで次の画面を受ける", () => {
    const stage = stageWith(frame)
    const move = focusMove(stage, { layer: { x: 230, y: 420 } })
    expect(move.enter).toBe("dolly")
    expect(move.exit).toMatchObject({
      ...focusShot({ x: 230, y: 420 }, frame),
      ms: animationTiming.focus,
    })
  })

  it("動きを減らす設定と静止画モードでは寄らない", () => {
    const stage = stageWith(frame)
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
    }))
    expect(focusMove(stage, { layer: { x: 0, y: 0 } })).toEqual({
      enter: "none",
    })
    vi.unstubAllGlobals()
    stillClock.on = true
    expect(focusMove(stage, { layer: { x: 0, y: 0 } })).toEqual({
      enter: "none",
    })
  })
})

function stageWith(size: FocusFrame) {
  const artboard = {
    offsetLeft: size.layerLeft,
    offsetTop: size.layerTop,
    clientWidth: size.layerWidth,
    clientHeight: size.layerHeight,
  } as HTMLDivElement
  const canvas = {
    clientWidth: size.viewportWidth,
    clientHeight: size.viewportHeight,
  } as HTMLElement
  return {
    artboard,
    canvas: { current: canvas },
    camera: { cam: { x: 0, y: 0, z: 1, r: 0, blur: 0 } } as never,
  }
}
