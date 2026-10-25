import {
  type WizContentShopDialogue,
  type WizContentShopDialogueTopic,
  zWizContentShopDialogues,
} from "@/lib/wiz/core/definition/shop/dialogue"
import { getWizImmutableRecordValue } from "@/lib/wiz/core/immutable-record"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"

const createDialogueRecord = (
  dialogues: readonly WizContentShopDialogue[],
): Readonly<Record<string, WizContentShopDialogue>> => {
  const record = Object.create(null) as Record<string, WizContentShopDialogue>
  for (const dialogue of dialogues) {
    Object.defineProperty(record, dialogue.shopId, {
      configurable: true,
      enumerable: true,
      value: dialogue,
      writable: false,
    })
  }
  return Object.freeze(record)
}

export class WizEngineShopDialogueService {
  readonly #dialogues: Readonly<Record<string, WizContentShopDialogue>>

  constructor(json: unknown) {
    const parsed = zWizContentShopDialogues.parse(json)
    const ownedDialogues = new WizObjectService().ownImmutable(parsed)
    this.#dialogues = createDialogueRecord(ownedDialogues)
    Object.freeze(this)
  }

  getDialogue(shopId: string): WizContentShopDialogue | null {
    return getWizImmutableRecordValue(this.#dialogues, shopId) ?? null
  }

  getAvailableTopics(
    dialogues: WizContentShopDialogue,
    affinity: number,
    flags: readonly string[],
    level: number = 1,
  ): readonly WizContentShopDialogueTopic[] {
    return Object.freeze(
      dialogues.topics.filter((topic) => {
        if (!topic.condition) return true
        if (topic.condition.minAffinity && affinity < topic.condition.minAffinity) {
          return false
        }
        if (topic.condition.flag && !flags.includes(topic.condition.flag)) {
          return false
        }
        if (topic.condition.minLevel && level < topic.condition.minLevel) {
          return false
        }
        if (topic.condition.maxLevel && level > topic.condition.maxLevel) {
          return false
        }
        return true
      }),
    )
  }
}

Object.freeze(WizEngineShopDialogueService.prototype)
Object.freeze(WizEngineShopDialogueService)
