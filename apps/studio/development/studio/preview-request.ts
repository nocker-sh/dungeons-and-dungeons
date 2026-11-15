import type { StudioConfig } from "@/development/studio/config"

export type PreviewRequest = {
  config: StudioConfig
  at: number
  guides: boolean
}
