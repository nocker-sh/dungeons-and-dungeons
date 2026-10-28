import { immutableConfig } from "@/lib/wiz/core/config/immutable-config"

export type WizEffectConfig = {
  readonly defaultBuffTurns: number
  readonly defaultDebuffTurns: number
  readonly defaultEffectTurns: number
}

export const DEFAULT_EFFECT_CONFIG: WizEffectConfig = immutableConfig({
  defaultBuffTurns: 3,
  defaultDebuffTurns: 3,
  defaultEffectTurns: 3,
})
