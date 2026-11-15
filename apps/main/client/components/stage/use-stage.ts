import type { AnimationBarrier } from "@/client/components/canvas/animation"
import { createContext, useContext } from "react"
import type { RefObject } from "react"
import type { Camera } from "@/client/components/stage/camera"
import type { FxStore } from "@/client/components/stage/fx/store"
import type { StageDirector } from "@/client/components/stage/director"

export type StageApi = Readonly<{
  exits: AnimationBarrier
  updates: AnimationBarrier
  camera: Camera
  fxStore: FxStore
  /** ゲームが映る画面（Canvas）。描画用の <canvas> 要素ではない。 */
  canvas: RefObject<HTMLElement | null>
  set: RefObject<HTMLDivElement | null>
  /** 背景と同じカメラで動く面。入口などに結びつくUIの描画先。 */
  artboard: HTMLDivElement | null
  /** 黒帯と暗がりより上の面。設定・戻るなど、どの場面でも隠さない共通UIの描画先。 */
  chrome: HTMLDivElement | null
  /**
   * 背景の一枚絵を差し替える。null で黒。
   * 読み込みと展開（decode）が済むまで前の絵を出したままにし、済んだら一度に替える。
   * 差し替えて次の描画が終わったら解決する。後から別の絵を頼んだら、前の頼みは捨てる。
   */
  art: (src: string | null) => Promise<void>
  /** 画面の上下の黒帯。単位は --u。 */
  bars: (u: number) => void
  /** 今なにが画面を占めているか。場面のUI・共通UI・隊列の見せ方はここから決まる（直に隠さない）。 */
  director: StageDirector
  /** それだけを見せる面（`<Solo>` の描画先）。 */
  solo: HTMLDivElement | null
}>

export const StageContext = createContext<StageApi | null>(null)

export function useStage() {
  const stage = useContext(StageContext)
  if (!stage) throw new Error("useStage must be used inside <Stage>")
  return stage
}
