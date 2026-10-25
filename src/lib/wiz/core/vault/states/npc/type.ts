import type { WizContentDialogue } from "@/lib/wiz/core/definition/npc/dialogue"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import type { WizId } from "@/lib/wiz/core/types"

const npcStateOwnership = new WizObjectService()

export type WizVaultDialogue = WizDeepReadonly<WizContentDialogue>

export type WizVaultGiftPreferences = {
  readonly likes: readonly WizId[]
  readonly dislikes: readonly WizId[]
  readonly likeBonus?: number
  readonly dislikeBonus?: number
  readonly neutralBonus?: number
}

export type WizVaultGiftBonuses = WizDeepReadonly<{
  like: number
  dislike: number
  neutral: number
}>

export const WIZ_VAULT_DEFAULT_GIFT_BONUSES: WizVaultGiftBonuses = npcStateOwnership.ownImmutable({
  like: 10,
  dislike: -5,
  neutral: 1,
})

export type WizVaultNpc<TCustom = object> = {
  readonly id: WizId
  readonly name: string
  readonly title?: string
  readonly occupation?: string
  readonly personality?: string
  readonly portrait?: string
  readonly affinity: number
  readonly dialogues: readonly WizVaultDialogue[]
  readonly giftPreferences?: WizVaultGiftPreferences
} & TCustom
