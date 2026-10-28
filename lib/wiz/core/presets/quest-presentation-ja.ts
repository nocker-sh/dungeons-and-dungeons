import type { WizSceneQuestMessage } from "@/lib/wiz/core/runtime/scenes/quest/state"

export type WizQuestPresentationJaResolvers = Readonly<{
  quest?: (questId: string) => string | undefined
}>

export type WizQuestPresentationJaTemplates = Readonly<{
  selectionRejected: (value: Readonly<{ questId: string }>) => string
  accepted: (value: Readonly<{ questName: string }>) => string
  noSelection: () => string
  alreadyAccepted: (value: Readonly<{ questName: string }>) => string
  notAccepted: (value: Readonly<{ questName: string }>) => string
  alreadyCompleted: (value: Readonly<{ questName: string }>) => string
  questNotFound: (value: Readonly<{ questId: string }>) => string
  objectiveTargetNotFound: (value: Readonly<{ targetId: string }>) => string
  objectiveIncomplete: (value: Readonly<{ current: number; required: number }>) => string
  completed: (
    value: Readonly<{ questName: string; gold: number; exp: number; affinityBonus: number }>,
  ) => string
}>

export const DEFAULT_QUEST_PRESENTATION_JA: WizQuestPresentationJaTemplates = Object.freeze({
  selectionRejected: ({ questId }) => `依頼「${questId}」が見つからない。`,
  accepted: ({ questName }) => `「${questName}」の依頼を受けた!`,
  noSelection: () => "依頼が選択されていない。",
  alreadyAccepted: ({ questName }) => `「${questName}」は受注済みだ。`,
  notAccepted: ({ questName }) => `「${questName}」は受注していない。`,
  alreadyCompleted: ({ questName }) => `「${questName}」は完了済みだ。`,
  questNotFound: ({ questId }) => `依頼「${questId}」が見つからない。`,
  objectiveTargetNotFound: ({ targetId }) => `対象「${targetId}」が見つからない。`,
  objectiveIncomplete: ({ current, required }) =>
    `まだ条件を満たしていない... (${current}/${required})`,
  completed: ({ questName, gold, exp }) => `「${questName}」依頼完了! ${gold}G, ${exp}EXP獲得!`,
})

export type WizQuestPresentationJaDefinition = Readonly<{
  resolvers?: WizQuestPresentationJaResolvers
  templates?: Partial<WizQuestPresentationJaTemplates>
}>

export class WizQuestPresentationJa {
  private readonly resolvers: WizQuestPresentationJaResolvers
  private readonly templates: WizQuestPresentationJaTemplates

  constructor(dependencies: WizQuestPresentationJaDefinition = {}) {
    this.resolvers = Object.freeze({ ...dependencies.resolvers })
    this.templates = Object.freeze({
      ...DEFAULT_QUEST_PRESENTATION_JA,
      ...dependencies.templates,
    })
    Object.freeze(this)
  }

  formatMessage(message: WizSceneQuestMessage): string {
    const templates = this.templates

    if (message.type === "quest_selection_rejected") {
      return templates.selectionRejected({ questId: message.questId })
    }
    if (message.type === "quest_accepted") {
      return templates.accepted({
        questName: this.resolveQuest(message.questId),
      })
    }
    if (message.type === "quest_acceptance_rejected") {
      if (message.reason === "no_selection") return templates.noSelection()
      const questName = this.resolveQuest(message.questId ?? "")
      return message.reason === "already_accepted"
        ? templates.alreadyAccepted({ questName })
        : templates.alreadyCompleted({ questName })
    }
    if (message.type === "quest_completed") {
      return templates.completed({
        questName: this.resolveQuest(message.questId),
        gold: message.reward.gold,
        exp: message.reward.exp,
        affinityBonus: message.reward.affinityBonus,
      })
    }

    const rejection = message.rejection
    if (rejection.type === "no_selection") return templates.noSelection()
    if (rejection.type === "quest_not_found") {
      return templates.questNotFound({ questId: rejection.questId })
    }
    if (rejection.type === "quest_not_accepted") {
      return templates.notAccepted({
        questName: this.resolveQuest(rejection.questId),
      })
    }
    if (rejection.type === "quest_already_completed") {
      return templates.alreadyCompleted({
        questName: this.resolveQuest(rejection.questId),
      })
    }
    if (rejection.type === "objective_target_not_found") {
      return templates.objectiveTargetNotFound({ targetId: rejection.targetId })
    }
    return templates.objectiveIncomplete({
      current: rejection.current,
      required: rejection.required,
    })
  }

  private resolveQuest(questId: string): string {
    return this.resolvers.quest?.(questId) ?? questId
  }
}

Object.freeze(WizQuestPresentationJa.prototype)
Object.freeze(WizQuestPresentationJa)
