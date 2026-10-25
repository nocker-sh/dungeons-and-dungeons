import { z } from "zod"
import {
  type WizContentMonster,
  zWizContentMonster,
} from "@/lib/wiz/core/definition/monster/monster"
import {
  createWizImmutableRecord,
  getWizImmutableRecordValue,
} from "@/lib/wiz/core/immutable-record"
import { WizVaultMissingDefinitionError } from "@/lib/wiz/core/vault/factory/missing-definition-error"
import { ownWizVaultFactoryValue } from "@/lib/wiz/core/vault/factory/ownership"
import type { WizVaultMonsterState } from "@/lib/wiz/core/vault/states/monster/schema"

/** 外部入力の期待形状: WizContentMonster[]。unknown を zod で実行時検証する。 */
type Properties = {
  readonly defs: unknown
}

export class WizVaultMonsterStateFactory {
  private readonly monsters: Readonly<Record<string, WizVaultMonsterState>>

  constructor(properties: Properties) {
    const parsed = z.array(zWizContentMonster).parse(properties.defs)
    this.monsters = createWizImmutableRecord(
      parsed.map((def) => {
        const monster = ownWizVaultFactoryValue(this.fromDef(def))
        return [monster.id, monster] as const
      }),
    )
    Object.freeze(this)
  }

  private fromDef(def: WizContentMonster): WizVaultMonsterState {
    return {
      id: def.id,
      name: def.name,
      hp: def.hp,
      maxHp: def.hp,
      attack: def.attack,
      defense: def.defense,
      agility: def.agility,
      expReward: def.expReward,
      goldReward: def.goldReward,
      drops: def.drops,
    }
  }

  get(id: string): WizVaultMonsterState | undefined {
    return getWizImmutableRecordValue(this.monsters, id)
  }

  getAll(): Readonly<Record<string, WizVaultMonsterState>> {
    return this.monsters
  }

  getMany(ids: readonly string[]): readonly WizVaultMonsterState[] {
    const monsters = ids.map((id) => this.get(id))
    const missingIds = ids.filter((_, index) => monsters[index] === undefined)
    if (missingIds.length > 0) {
      throw new WizVaultMissingDefinitionError("monster", missingIds)
    }
    return ownWizVaultFactoryValue(
      monsters.filter((monster): monster is WizVaultMonsterState => monster !== undefined),
    )
  }
}
