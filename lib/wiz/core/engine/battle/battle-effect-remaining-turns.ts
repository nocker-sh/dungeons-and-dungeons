import { WizEffect } from "@/lib/wiz/core/domain/values/effect-set"

export const battleEffectRemainingTurns = (effect: WizEffect): number => {
  if (effect.lifetime.type === "permanent") return -1
  if (effect.lifetime.type === "turns") return effect.lifetime.remaining
  throw new TypeError(
    `Battle effect "${effect.instanceId}" must use turns or permanent lifetime`
  )
}
