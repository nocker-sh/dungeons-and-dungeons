import type { WizEffect } from "@/lib/wiz/core/domain/values/effect-set"
import { WIZ_IMMUTABLE_VALUE, WizImmutableValue } from "@/lib/wiz/core/immutable-value"
import {
  WizEmptyEnemyPartyError,
  WizMonsterGroupNotFoundError,
  WizMonsterNotFoundError,
} from "@/lib/wiz/core/errors"
import type { WizBattleMonster } from "@/lib/wiz/core/engine/battle/actors/monster"
import type { WizBattleMonsterGroup } from "@/lib/wiz/core/engine/battle/actors/monster-group"

type Properties<TStatus = unknown, TCustom = unknown> = {
  readonly id: string
  readonly groups: readonly WizBattleMonsterGroup<TStatus, TCustom>[]
}

export class WizBattleEnemyParty<TStatus = unknown, TCustom = unknown> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly id: string
  readonly groups: readonly WizBattleMonsterGroup<TStatus, TCustom>[]

  constructor(properties: Properties<TStatus, TCustom>) {
    if (properties.groups.length === 0) {
      throw new WizEmptyEnemyPartyError()
    }
    this.id = properties.id
    this.groups = Object.freeze([...properties.groups])
    WizImmutableValue.freeze(this)
  }

  getAllMonsters(): readonly WizBattleMonster<TStatus, TCustom>[] {
    return this.groups.flatMap((g) => g.members)
  }

  getAllAliveMonsters(): readonly WizBattleMonster<TStatus, TCustom>[] {
    return this.groups.flatMap((g) => g.getAliveMembers())
  }

  getActableMonsters(): readonly WizBattleMonster<TStatus, TCustom>[] {
    return this.groups.flatMap((g) => g.getActableMembers())
  }

  getActableMonstersIds(): readonly string[] {
    return this.getActableMonsters().map((m) => m.id)
  }

  getAliveCount(): number {
    return this.groups.reduce((sum, g) => sum + g.getAliveCount(), 0)
  }

  getTotalCount(): number {
    return this.groups.reduce((sum, g) => sum + g.getTotalCount(), 0)
  }

  getGroupById(groupId: string): WizBattleMonsterGroup<TStatus, TCustom> | undefined {
    return this.groups.find((g) => g.id === groupId)
  }

  getGroupByIndex(index: number): WizBattleMonsterGroup<TStatus, TCustom> | undefined {
    return this.groups[index]
  }

  getMonsterById(monsterId: string): WizBattleMonster<TStatus, TCustom> | undefined {
    for (const group of this.groups) {
      const monster = group.getMemberById(monsterId)
      if (monster) {
        return monster
      }
    }
    return undefined
  }

  requireMonsterById(monsterId: string): WizBattleMonster<TStatus, TCustom> {
    const monster = this.getMonsterById(monsterId)
    if (!monster) {
      throw new WizMonsterNotFoundError(monsterId)
    }
    return monster
  }

  requireGroupById(groupId: string): WizBattleMonsterGroup<TStatus, TCustom> {
    const group = this.getGroupById(groupId)
    if (!group) {
      throw new WizMonsterGroupNotFoundError(groupId)
    }
    return group
  }

  getAliveGroups(): readonly WizBattleMonsterGroup<TStatus, TCustom>[] {
    return this.groups.filter((g) => !g.isDefeated())
  }

  withDamageToMonster(monsterId: string, amount: number): WizBattleEnemyParty<TStatus, TCustom> {
    this.requireMonsterById(monsterId)
    const updatedGroups = this.groups.map((g) => {
      const monster = g.getMemberById(monsterId)
      if (monster) {
        return g.withDamageToMember(monsterId, amount)
      }
      return g
    })
    return new WizBattleEnemyParty({
      id: this.id,
      groups: updatedGroups,
    })
  }

  withDamageToGroup(groupId: string, amount: number): WizBattleEnemyParty<TStatus, TCustom> {
    this.requireGroupById(groupId)
    const updatedGroups = this.groups.map((g) => (g.id === groupId ? g.withDamageToAll(amount) : g))
    return new WizBattleEnemyParty({
      id: this.id,
      groups: updatedGroups,
    })
  }

  withDamageToAll(amount: number): WizBattleEnemyParty<TStatus, TCustom> {
    const updatedGroups = this.groups.map((g) => g.withDamageToAll(amount))
    return new WizBattleEnemyParty({
      id: this.id,
      groups: updatedGroups,
    })
  }

  withHealToMonster(monsterId: string, amount: number): WizBattleEnemyParty<TStatus, TCustom> {
    this.requireMonsterById(monsterId)
    const updatedGroups = this.groups.map((g) => {
      const monster = g.getMemberById(monsterId)
      if (monster) {
        return g.withHealToMember(monsterId, amount)
      }
      return g
    })
    return new WizBattleEnemyParty({
      id: this.id,
      groups: updatedGroups,
    })
  }

  withEffectToMonster(monsterId: string, effect: WizEffect): WizBattleEnemyParty<TStatus, TCustom> {
    this.requireMonsterById(monsterId)
    const updatedGroups = this.groups.map((g) => {
      const monster = g.getMemberById(monsterId)
      if (monster) {
        return g.withEffectToMember(monsterId, effect)
      }
      return g
    })
    return new WizBattleEnemyParty({
      id: this.id,
      groups: updatedGroups,
    })
  }

  withGroup(group: WizBattleMonsterGroup<TStatus, TCustom>): WizBattleEnemyParty<TStatus, TCustom> {
    const updatedGroups = this.groups.map((g) => (g.id === group.id ? group : g))
    return new WizBattleEnemyParty({
      id: this.id,
      groups: updatedGroups,
    })
  }

  withMonster(monster: WizBattleMonster<TStatus, TCustom>): WizBattleEnemyParty<TStatus, TCustom> {
    const updatedGroups = this.groups.map((g) => {
      if (g.getMemberById(monster.id)) {
        return g.withMember(monster)
      }
      return g
    })
    return new WizBattleEnemyParty({
      id: this.id,
      groups: updatedGroups,
    })
  }

  advanceEffects(): WizBattleEnemyParty<TStatus, TCustom> {
    const updatedGroups = this.groups.map((group) => group.advanceEffects())
    return new WizBattleEnemyParty({
      id: this.id,
      groups: updatedGroups,
    })
  }

  withReviveMonster(
    monsterId: string,
    hpPercentage: number,
  ): WizBattleEnemyParty<TStatus, TCustom> {
    this.requireMonsterById(monsterId)
    const updatedGroups = this.groups.map((g) => {
      const monster = g.getMemberById(monsterId)
      if (monster) {
        return g.withReviveMember(monsterId, hpPercentage)
      }
      return g
    })
    return new WizBattleEnemyParty({
      id: this.id,
      groups: updatedGroups,
    })
  }

  getDeadMonsters(): readonly WizBattleMonster<TStatus, TCustom>[] {
    return this.groups.flatMap((g) => g.getDeadMembers())
  }

  getDeadMonsterIds(): readonly string[] {
    return this.getDeadMonsters().map((m) => m.id)
  }

  isDefeated(): boolean {
    return this.groups.every((g) => g.isDefeated())
  }

  toProperties(): Properties<TStatus, TCustom> {
    return {
      id: this.id,
      groups: this.groups,
    }
  }
}
