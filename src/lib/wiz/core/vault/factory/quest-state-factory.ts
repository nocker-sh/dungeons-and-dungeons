import { z } from "zod"
import {
  type WizContentQuest,
  type WizContentQuestObjective,
  zWizContentQuest,
} from "@/lib/wiz/core/definition/quest/quest"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { ownWizVaultFactoryValue } from "@/lib/wiz/core/vault/factory/ownership"
import type {
  WizVaultQuestObjectiveState,
  WizVaultQuestState,
} from "@/lib/wiz/core/vault/states/quest/schema"

/** 外部入力の期待形状: WizContentQuest[]。unknown を zod で実行時検証する。 */
type Properties = {
  readonly defs: unknown
}

export class WizVaultQuestStateFactory {
  private readonly quests: readonly WizDeepReadonly<WizVaultQuestState>[]

  constructor(properties: Properties) {
    const parsed = z.array(zWizContentQuest).parse(properties.defs)
    this.quests = ownWizVaultFactoryValue(parsed.map((def) => this.fromDef(def)))
    Object.freeze(this)
  }

  private fromDef(def: WizContentQuest): WizVaultQuestState {
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      giverNpcId: def.giverNpcId,
      objective: this.objectiveFromDef(def.objective),
      reward: {
        gold: def.reward.gold,
        exp: def.reward.exp,
        affinityBonus: def.reward.affinityBonus,
        items: def.reward.items,
      },
      completed: false,
      accepted: false,
      nextQuestId: def.nextQuestId,
    }
  }

  private objectiveFromDef(def: WizContentQuestObjective): WizVaultQuestObjectiveState {
    if (def.type === "defeat") {
      return {
        type: "defeat",
        monsterId: def.monsterId,
        count: def.count,
        current: 0,
      }
    }
    if (def.type === "gather") {
      return {
        type: "gather",
        itemId: def.itemId,
        count: def.count,
        current: 0,
      }
    }
    if (def.type === "explore") {
      return {
        type: "explore",
        areaId: def.areaId,
        requiredProgress: def.requiredProgress,
      }
    }
    // deliver
    return {
      type: "deliver",
      itemId: def.itemId,
      npcId: def.npcId,
    }
  }

  getAll(): readonly WizDeepReadonly<WizVaultQuestState>[] {
    return this.quests
  }
}
