import { z } from "zod"
import { type WizContentArea, zWizContentArea } from "@/lib/wiz/core/definition/area/area"
import type { WizVaultEventStateFactory } from "@/lib/wiz/core/vault/factory/event-state-factory"
import type { WizVaultMonsterStateFactory } from "@/lib/wiz/core/vault/factory/monster-state-factory"
import { ownWizVaultFactoryValue } from "@/lib/wiz/core/vault/factory/ownership"
import type { WizVaultAreaState } from "@/lib/wiz/core/vault/states/area/schema"

/** 外部入力の期待形状: WizContentArea[]。unknown を zod で実行時検証する。 */
type Properties = {
  readonly defs: unknown
  readonly monsterFactory: WizVaultMonsterStateFactory
  readonly eventFactory: WizVaultEventStateFactory
}

export class WizVaultAreaStateFactory {
  private readonly areas: readonly WizVaultAreaState[]

  constructor(properties: Properties) {
    const parsed = z.array(zWizContentArea).parse(properties.defs)
    this.areas = ownWizVaultFactoryValue(parsed.map((def) => this.fromDef(def, properties)))
    Object.freeze(this)
  }

  private fromDef(def: WizContentArea, properties: Properties): WizVaultAreaState {
    return {
      id: def.id,
      name: def.name,
      description: def.description,
      dangerLevel: def.dangerLevel,
      apCost: def.apCost,
      progress: 0,
      unlocked: def.unlocked,
      unlockCondition: def.unlockCondition,
      availableGathering: def.availableGathering,
      monsters: properties.monsterFactory.getMany(def.monsterIds),
      events: properties.eventFactory.getMany(def.eventIds),
    }
  }

  getAll(): readonly WizVaultAreaState[] {
    return this.areas
  }
}
