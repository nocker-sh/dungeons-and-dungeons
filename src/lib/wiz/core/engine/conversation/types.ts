import type {
  WizContentDialogueLine,
  WizContentDialogueOption,
} from "@/lib/wiz/core/definition/npc/dialogue"
import type { WizGiftReaction } from "@/lib/wiz/core/engine/conversation/affinity-system"
import type { WizFlags, WizId } from "@/lib/wiz/core/types"
import type { WizVaultAffinityChange } from "@/lib/wiz/core/vault/states/npc/affinity"
import type { WizVaultNpc } from "@/lib/wiz/core/vault/states/npc/type"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

export type WizConversationEvent =
  | Readonly<{
      type: "dialogue_completed"
      npcId: WizId
      affinityChange: WizVaultAffinityChange
    }>
  | Readonly<{
      type: "gift_applied"
      npcId: WizId
      itemId: WizId
      reaction: WizGiftReaction
      /** NPC content由来の、上下限適用前の正規ボーナス。 */
      affinityBonus: number
      affinityChange: WizVaultAffinityChange
    }>

export type WizConversationRejection =
  | Readonly<{ type: "npc_not_found"; npcId: WizId }>
  | Readonly<{ type: "item_not_owned"; itemId: WizId }>

export type WizConversationResult =
  | Readonly<{
      applied: true
      vault: WizVaultValue
      events: readonly WizConversationEvent[]
    }>
  | Readonly<{
      applied: false
      vault: WizVaultValue
      rejection: WizConversationRejection
    }>

// Scene-specific types
export type WizEngineConversationPhase =
  | { readonly type: "idle" }
  | {
      readonly type: "talking"
      readonly npcId: WizId
      readonly dialogueId: WizId
      readonly lineIndex: number
      readonly currentLine: WizContentDialogueLine
    }
  | {
      readonly type: "choosing"
      readonly npcId: WizId
      readonly dialogueId: WizId
      readonly options: readonly WizContentDialogueOption[]
    }
  | {
      readonly type: "ended"
      readonly npcId: WizId
    }

export type WizEngineConversationState<TCustom = object> = {
  readonly phase: WizEngineConversationPhase
  readonly npcs: readonly WizVaultNpc[]
  readonly talkedToday: readonly WizId[]
  readonly flags: WizFlags
  readonly events: readonly WizConversationEvent[]
} & TCustom
