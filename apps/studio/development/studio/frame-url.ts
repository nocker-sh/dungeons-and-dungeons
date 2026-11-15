import type { StudioConfig } from "@/development/studio/config"

export function frameUrl(config: StudioConfig) {
  return `/frame/${encodeURIComponent(config.scene)}?config=${encodeURIComponent(JSON.stringify(config))}`
}
