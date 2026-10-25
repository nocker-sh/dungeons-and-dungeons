import type { WizId } from "@/lib/wiz/core/types"

export type WizVaultAffinityChangeReason =
  | Readonly<{ type: "dialogue_completed" }>
  | Readonly<{ type: "gift_received"; itemId: WizId }>
  | Readonly<{ type: "dialogue_option"; optionId: WizId }>
  | Readonly<{ type: "dialogue_effect" }>
  | Readonly<{ type: "quest_reward"; questId: WizId }>
  | Readonly<{ type: "custom"; id: string }>

export type WizVaultAffinityChange = {
  readonly npcId: WizId
  readonly previousAffinity: number
  readonly newAffinity: number
  readonly change: number
  readonly reason: WizVaultAffinityChangeReason
}
