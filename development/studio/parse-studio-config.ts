import { layoutPattern } from "@/development/studio/layout-pattern"
import { PARTY_SLOTS } from "@/lib/wiz/content/constants"
import type { StudioConfig } from "@/development/studio/config"
import { studioConfigSchema } from "@/development/studio/config"

export function parseStudioConfig(value: unknown): StudioConfig {
  studioConfigSchema.partial().parse(value)
  const input = value as Partial<StudioConfig>
  const pattern = layoutPattern(input.scene ?? "battle")
  const config = studioConfigSchema.parse({
    ...(pattern
      ? {
          seed: pattern.seed,
          hp: pattern.hp,
          foes: pattern.foes,
          actions: pattern.actions,
          duration: Math.max(6000, pattern.at + 2000),
        }
      : {}),
    ...input,
  })
  if (new Set(config.party).size !== PARTY_SLOTS)
    throw new Error("隊列は異なる3人を選んでください")
  if (config.party[0] !== "hero") throw new Error("隊列の先頭はプレイヤーです")
  if (config.hp.every((hp) => hp === 0))
    throw new Error("少なくとも1人を生存させてください")
  if (config.actions.some((action) => action.at > config.duration))
    throw new Error("操作の時刻がタイムラインを超えています")
  return config
}
