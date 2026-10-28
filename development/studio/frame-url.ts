import type { StudioConfig } from "@/development/studio/config"

export function frameUrl(config: StudioConfig) {
  return `/dev/frame/${encodeURIComponent(config.scene)}?config=${encodeURIComponent(JSON.stringify(config))}`
}
