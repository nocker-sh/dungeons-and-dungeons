import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { z } from "zod"
import { WizVaultAreaStateFactory } from "@/lib/wiz/core/vault/factory/area-state-factory"
import { WizVaultEventStateFactory } from "@/lib/wiz/core/vault/factory/event-state-factory"
import { WizVaultMonsterStateFactory } from "@/lib/wiz/core/vault/factory/monster-state-factory"
import { WizVaultNpcStateFactory } from "@/lib/wiz/core/vault/factory/npc-state-factory"
import { WizVaultQuestStateFactory } from "@/lib/wiz/core/vault/factory/quest-state-factory"
import type { WizVaultAreaState } from "@/lib/wiz/core/vault/states/area/schema"
import type { WizVaultEventState } from "@/lib/wiz/core/vault/states/event/schema"
import { WIZ_STANDARD_DEFAULT_INVENTORY } from "@/lib/wiz/core/vault/standard-inventory"
import { zWizVaultSemanticId } from "@/lib/wiz/core/vault/states/schema-values"
import {
  WIZ_VAULT_DEFAULT_PARTY_MEMBERS,
  WIZ_VAULT_DEFAULT_PLAYER,
} from "@/lib/wiz/core/vault/states/player/schema"
import type { WizVaultMonsterState } from "@/lib/wiz/core/vault/states/monster/schema"
import type { WizVaultNpc } from "@/lib/wiz/core/vault/states/npc/type"
import type { WizVaultQuestState } from "@/lib/wiz/core/vault/states/quest/schema"
import { WIZ_VAULT_DEFAULT_TIME } from "@/lib/wiz/core/vault/states/time/schema"
import { WizVaultValue } from "@/lib/wiz/core/vault/value"

/**
 * 各フィールドの期待形状:
 * - monsters: WizContentMonster[]
 * - events: WizContentEvent[]
 * - areas: WizContentArea[]
 * - npcs: WizContentNpc[]
 * - quests: WizContentQuest[]
 *
 * 外部 JSON を `unknown` で受け付け、各 child factory が zod で実行時バリデーションする。
 */
type Properties = {
  readonly monsters: unknown
  readonly events: unknown
  readonly areas: unknown
  readonly npcs: unknown
  readonly quests: unknown
  readonly equipmentSlotIds: unknown
}

const equipmentSlotIdsSchema = z
  .array(zWizVaultSemanticId)
  .superRefine((slotIds, context) => {
    const firstIndexById = new Map<string, number>()
    slotIds.forEach((slotId, index) => {
      const firstIndex = firstIndexById.get(slotId)
      if (firstIndex === undefined) {
        firstIndexById.set(slotId, index)
        return
      }
      context.addIssue({
        code: "custom",
        path: [index],
        message: `Duplicate equipment slot ID; first declared at equipmentSlotIds[${firstIndex}]`,
      })
    })
  })

/** Creates initial WizVaultValue from raw JSON asset data. */
export class WizVaultFactory {
  private readonly monsterFactory: WizVaultMonsterStateFactory
  private readonly eventFactory: WizVaultEventStateFactory
  private readonly areaFactory: WizVaultAreaStateFactory
  private readonly npcFactory: WizVaultNpcStateFactory
  private readonly questFactory: WizVaultQuestStateFactory
  private readonly equipment: Readonly<Record<string, null>>

  constructor(properties: Properties) {
    this.monsterFactory = new WizVaultMonsterStateFactory({
      defs: properties.monsters,
    })
    this.eventFactory = new WizVaultEventStateFactory({
      defs: properties.events,
    })
    this.areaFactory = new WizVaultAreaStateFactory({
      defs: properties.areas,
      monsterFactory: this.monsterFactory,
      eventFactory: this.eventFactory,
    })
    this.npcFactory = new WizVaultNpcStateFactory({ defs: properties.npcs })
    this.questFactory = new WizVaultQuestStateFactory({
      defs: properties.quests,
    })
    this.equipment = Object.freeze(
      Object.fromEntries(
        equipmentSlotIdsSchema
          .parse(properties.equipmentSlotIds)
          .map((slotId) => [slotId, null])
      )
    )
    Object.freeze(this)
  }

  createInitialVault(): WizVaultValue {
    return WizVaultValue.fromPlain({
      player: WIZ_VAULT_DEFAULT_PLAYER,
      partyMembers: WIZ_VAULT_DEFAULT_PARTY_MEMBERS,
      inventory: WIZ_STANDARD_DEFAULT_INVENTORY,
      equipment: this.equipment,
      time: WIZ_VAULT_DEFAULT_TIME,
      areas: this.areaFactory.getAll(),
      npcs: this.npcFactory.getAll(),
      quests: this.questFactory.getAll(),
      flags: [],
      log: [{ key: "WORLD_STARTED" }],
      unlockedFacilities: [],
      isEnded: false,
    })
  }

  getMonsters(): Readonly<Record<string, WizVaultMonsterState>> {
    return this.monsterFactory.getAll()
  }

  getEvents(): Readonly<Record<string, WizVaultEventState>> {
    return this.eventFactory.getAll()
  }

  getAreas(): readonly WizVaultAreaState[] {
    return this.areaFactory.getAll()
  }

  getNpcs(): readonly WizDeepReadonly<WizVaultNpc>[] {
    return this.npcFactory.getAll()
  }

  getQuests(): readonly WizDeepReadonly<WizVaultQuestState>[] {
    return this.questFactory.getAll()
  }
}
