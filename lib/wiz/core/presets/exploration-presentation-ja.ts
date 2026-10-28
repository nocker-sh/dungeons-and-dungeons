import type { WizExplorationActionType } from "@/lib/wiz/core/config/exploration/wiz-exploration-config"
import type { WizSceneExplorationMessage } from "@/lib/wiz/core/runtime/scenes/exploration/states/state"

export const WIZ_EXPLORATION_ACTION_NAMES_JA: Readonly<Record<WizExplorationActionType, string>> =
  Object.freeze({
    explore: "探索する",
    gather: "採集する",
    hunt: "狩りをする",
    rest: "休憩する",
    return: "帰還する",
  })

export type WizExplorationPresentationJaResolvers = Readonly<{
  item?: (itemId: string) => string | undefined
  event?: (eventId: string) => string | undefined
}>

export type WizExplorationPresentationJaTemplates = Readonly<{
  eventEncountered: (value: Readonly<{ eventName: string }>) => string
  itemsGathered: (value: Readonly<{ itemNames: readonly string[] }>) => string
  gatheringUnavailable: () => string
  gatheringBlockedByEnvironment: () => string
  areaNotFound: (value: Readonly<{ areaId: string }>) => string
  notEnoughAp: () => string
  noTargetsAvailable: () => string
  randomSelectionFailed: () => string
  contentNotFound: (value: Readonly<{ referenceId: string }>) => string
  alreadyRested: () => string
  eventNotActive: () => string
  choiceNotFound: (value: Readonly<{ choiceIndex: number }>) => string
  choiceNotSelected: () => string
  itemNotFound: (value: Readonly<{ itemId: string }>) => string
  itemNotFood: (value: Readonly<{ itemName: string }>) => string
  itemNotOwned: (value: Readonly<{ itemName: string }>) => string
  itemEffectRejected: (value: Readonly<{ itemName: string }>) => string
}>

export const DEFAULT_EXPLORATION_PRESENTATION_JA: WizExplorationPresentationJaTemplates =
  Object.freeze({
    eventEncountered: ({ eventName }) => `${eventName}が発生した。`,
    itemsGathered: ({ itemNames }) => {
      const [first, ...bonuses] = itemNames
      if (!first) return "何も採集できなかった。"
      if (bonuses.length === 0) return `${first}を採集した!`
      return `${first}を採集した! ${bonuses.join("、")}もおまけで見つけた!`
    },
    gatheringUnavailable: () => "このエリアでは採集できるものがない。",
    gatheringBlockedByEnvironment: () => "天候が厳しく、採集できなかった...",
    areaNotFound: ({ areaId }) => `探索先「${areaId}」が見つからない。`,
    notEnoughAp: () => "APが足りない...",
    noTargetsAvailable: () => "対象が見つからない。",
    randomSelectionFailed: () => "対象を選べなかった。",
    contentNotFound: ({ referenceId }) => `コンテンツ「${referenceId}」が見つからない。`,
    alreadyRested: () => "十分に休んでいるので休憩の必要はない。",
    eventNotActive: () => "進行中のイベントがない。",
    choiceNotFound: ({ choiceIndex }) => `選択肢 ${choiceIndex} が見つからない。`,
    choiceNotSelected: () => "選択肢が選ばれていない。",
    itemNotFound: ({ itemId }) => `アイテム「${itemId}」が見つからない。`,
    itemNotFood: ({ itemName }) => `${itemName}は食料ではない。`,
    itemNotOwned: ({ itemName }) => `${itemName}を持っていない。`,
    itemEffectRejected: ({ itemName }) => `${itemName}は今は使えない。`,
  })

export type WizExplorationPresentationJaDefinition = Readonly<{
  resolvers?: WizExplorationPresentationJaResolvers
  templates?: Partial<WizExplorationPresentationJaTemplates>
}>

export class WizExplorationPresentationJa {
  private readonly resolvers: WizExplorationPresentationJaResolvers
  private readonly templates: WizExplorationPresentationJaTemplates

  constructor(dependencies: WizExplorationPresentationJaDefinition = {}) {
    this.resolvers = Object.freeze({ ...dependencies.resolvers })
    this.templates = Object.freeze({
      ...DEFAULT_EXPLORATION_PRESENTATION_JA,
      ...dependencies.templates,
    })
    Object.freeze(this)
  }

  formatMessage(message: WizSceneExplorationMessage): string {
    const templates = this.templates

    if (message.type === "event_encountered") {
      return templates.eventEncountered({
        eventName: this.resolvers.event?.(message.eventId) ?? message.eventId,
      })
    }
    if (message.type === "items_gathered") {
      return templates.itemsGathered({
        itemNames: Object.freeze(
          message.itemIds.map((itemId) => this.resolvers.item?.(itemId) ?? itemId),
        ),
      })
    }
    if (message.type === "gather_rejected") {
      return message.reason === "nothing_available"
        ? templates.gatheringUnavailable()
        : templates.gatheringBlockedByEnvironment()
    }
    if (message.type === "action_rejected") {
      if (message.reason === "area_not_found") {
        return templates.areaNotFound({ areaId: message.areaId })
      }
      if (message.reason === "not_enough_ap") return templates.notEnoughAp()
      if (message.reason === "no_targets_available") return templates.noTargetsAvailable()
      if (message.reason === "random_selection_failed") {
        return templates.randomSelectionFailed()
      }
      if (message.reason === "content_not_found") {
        return templates.contentNotFound({
          referenceId: message.referenceId ?? "",
        })
      }
      return templates.alreadyRested()
    }
    if (message.type === "event_choice_rejected") {
      return message.reason === "event_not_active"
        ? templates.eventNotActive()
        : templates.choiceNotFound({ choiceIndex: message.choiceIndex })
    }
    if (message.type === "event_roll_rejected") {
      if (message.reason === "event_not_active") return templates.eventNotActive()
      if (message.reason === "choice_not_selected") return templates.choiceNotSelected()
      return templates.choiceNotFound({ choiceIndex: message.choiceIndex ?? -1 })
    }

    const itemName = this.resolvers.item?.(message.itemId) ?? message.itemId
    if (message.reason === "item_not_found") {
      return templates.itemNotFound({ itemId: message.itemId })
    }
    if (message.reason === "not_food") return templates.itemNotFood({ itemName })
    if (message.reason === "not_owned") return templates.itemNotOwned({ itemName })
    return templates.itemEffectRejected({ itemName })
  }
}

Object.freeze(WizExplorationPresentationJa.prototype)
Object.freeze(WizExplorationPresentationJa)
