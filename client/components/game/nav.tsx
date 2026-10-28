import type { Shot } from "@/client/components/stage/camera"

export type Establish = "crane" | "dolly" | "pan" | "tilt" | "none"

export type Move = {
  exit?: Partial<Shot> & { ms?: number; in?: boolean }
  /** 退場の間に流す演出。終わってから次の画面へ。 */
  during?: () => Promise<void>
  enter?: Establish
}
