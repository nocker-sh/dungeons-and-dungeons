import type { StudioInspection } from "@/client/dev/studio-types"

export type PreviewBridge = {
  readonly mode: "view" | "play"
  readonly ready: boolean
  readonly stage: string
  readonly error: string | null
  inspect: () => StudioInspection | null
}
