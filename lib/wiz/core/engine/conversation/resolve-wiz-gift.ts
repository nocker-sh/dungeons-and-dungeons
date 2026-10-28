import type { WizId } from "@/lib/wiz/core/types"
import { WIZ_VAULT_DEFAULT_GIFT_BONUSES } from "@/lib/wiz/core/vault/states/npc/type"
import type { WizVaultGiftPreferences } from "@/lib/wiz/core/vault/states/npc/type"
import type {
  WizGiftResolution,
  WizGiftPreferenceReaction,
  WizGiftReaction,
} from "@/lib/wiz/core/engine/conversation/affinity-system"

/**
 * NPC contentとitem IDだけから贈答結果を決めるpure rule。
 *
 * 保存値やcallerの予想reactionはauthorityにしない。
 */
export function resolveWizGift(
  preferences: WizVaultGiftPreferences | undefined,
  itemId: WizId
): WizGiftResolution {
  const preference: WizGiftPreferenceReaction = preferences?.likes.includes(
    itemId
  )
    ? "like"
    : preferences?.dislikes.includes(itemId)
      ? "dislike"
      : "neutral"
  const reaction: WizGiftReaction =
    preference === "like"
      ? "love"
      : preference === "dislike"
        ? "dislike"
        : "neutral"
  const affinityChange =
    preference === "like"
      ? (preferences?.likeBonus ?? WIZ_VAULT_DEFAULT_GIFT_BONUSES.like)
      : preference === "dislike"
        ? (preferences?.dislikeBonus ?? WIZ_VAULT_DEFAULT_GIFT_BONUSES.dislike)
        : (preferences?.neutralBonus ?? WIZ_VAULT_DEFAULT_GIFT_BONUSES.neutral)

  return Object.freeze({ preference, reaction, affinityChange })
}
