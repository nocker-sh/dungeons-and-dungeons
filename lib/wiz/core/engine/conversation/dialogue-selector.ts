import { WizVaultRequirementService } from "@/lib/wiz/core/vault/services/requirement-service"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"
import type { WizVaultDialogue, WizVaultNpc } from "@/lib/wiz/core/vault/states/npc/type"

type Props = {
  readonly npc: WizVaultNpc
  readonly vault: WizVaultValue
}

const DIALOGUE_UNLOCK_FLAG_PREFIX = "__open_wiz_internal__/conversation/dialogue-unlocked/"

/**
 * Internal semantic receipt for `unlockDialogue`.
 *
 * Length prefixes make distinct `(npcId, dialogueId)` pairs collision-free even when IDs
 * themselves contain separators.
 */
export function createWizConversationDialogueUnlockFlag(npcId: string, dialogueId: string): string {
  return `${DIALOGUE_UNLOCK_FLAG_PREFIX}${npcId.length}:${npcId}${dialogueId.length}:${dialogueId}`
}

/**
 * 文脈 (好感度・時間帯・天候・季節・クエスト履歴) に合う台詞を選ぶ。
 * 条件が多い台詞ほど優先され、同条件数なら好感度の高い台詞が勝つ。
 */
export class WizEngineConversationDialogueSelector {
  private readonly requirementService: WizVaultRequirementService

  constructor(requirementService?: WizVaultRequirementService) {
    this.requirementService = requirementService ?? new WizVaultRequirementService()
    Object.freeze(this)
  }

  select(props: Props): WizVaultDialogue | undefined {
    let best: WizVaultDialogue | undefined = undefined
    let bestScore = -1

    for (const dialogue of props.npc.dialogues) {
      if (!this.isEligible(dialogue, props)) continue

      const score = this.getSpecificity(dialogue) * 1000 + (dialogue.minAffinity ?? 0)

      if (score >= bestScore) {
        best = dialogue
        bestScore = score
      }
    }

    return best
  }

  private isEligible(dialogue: WizVaultDialogue, props: Props): boolean {
    const affinity = props.npc.affinity

    if (
      this.isUnlockTarget(dialogue.id, props.npc) &&
      !props.vault.hasFlag(createWizConversationDialogueUnlockFlag(props.npc.id, dialogue.id))
    ) {
      return false
    }

    if (dialogue.minAffinity !== undefined && affinity < dialogue.minAffinity) return false

    if (dialogue.maxAffinity !== undefined && affinity > dialogue.maxAffinity) return false

    if (dialogue.requirements) {
      const meetsRequirements = this.requirementService.meetsRequirements(dialogue.requirements, {
        affinity,
        flags: props.vault.flags,
        inventory: props.vault.inventory,
        level: props.vault.player.level,
      })
      if (!meetsRequirements) return false
    }

    return this.matchesTriggers(dialogue, props)
  }

  private matchesTriggers(dialogue: WizVaultDialogue, props: Props): boolean {
    const triggers = dialogue.triggers

    if (!triggers) return true

    if (triggers.timeOfDay && !triggers.timeOfDay.includes(props.vault.time.timeOfDay)) return false

    if (triggers.weather && !triggers.weather.includes(props.vault.time.weather)) return false

    if (triggers.season && !triggers.season.includes(props.vault.time.season)) return false

    if (
      triggers.afterQuest &&
      !props.vault.quests.some((quest) => quest.id === triggers.afterQuest && quest.completed)
    ) {
      return false
    }

    return true
  }

  private isUnlockTarget(dialogueId: string, npc: WizVaultNpc): boolean {
    return npc.dialogues.some((dialogue) =>
      dialogue.options?.some((option) => option.effects?.unlockDialogue === dialogueId),
    )
  }

  private getSpecificity(dialogue: WizVaultDialogue): number {
    const triggers = dialogue.triggers

    if (!triggers) return 0

    let specificity = 0

    if (triggers.timeOfDay) specificity += 1
    if (triggers.weather) specificity += 1
    if (triggers.season) specificity += 1
    if (triggers.afterQuest) specificity += 1

    return specificity
  }
}
