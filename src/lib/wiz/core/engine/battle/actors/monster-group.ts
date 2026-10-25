import type { WizEffect } from "@/lib/wiz/core/domain/values/effect-set"
import { WizMonsterNotFoundError } from "@/lib/wiz/core/errors"
import type { WizBattleMonster } from "@/lib/wiz/core/engine/battle/actors/monster"
import { WIZ_IMMUTABLE_VALUE, WizImmutableValue } from "@/lib/wiz/core/immutable-value"

type Properties<TStatus = unknown, TCustom = unknown> = {
  readonly id: string
  readonly name: string
  readonly members: readonly WizBattleMonster<TStatus, TCustom>[]
}

export class WizBattleMonsterGroup<TStatus = unknown, TCustom = unknown> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly id: string
  readonly name: string
  readonly members: readonly WizBattleMonster<TStatus, TCustom>[]

  constructor(properties: Properties<TStatus, TCustom>) {
    this.id = properties.id
    this.name = properties.name
    this.members = Object.freeze([...properties.members])
    WizImmutableValue.freeze(this)
  }

  private with(
    overrides: Partial<Properties<TStatus, TCustom>>,
  ): WizBattleMonsterGroup<TStatus, TCustom> {
    return new WizBattleMonsterGroup({ ...this.toProperties(), ...overrides })
  }

  getAliveCount(): number {
    return this.members.filter((m) => m.isAlive()).length
  }

  getTotalCount(): number {
    return this.members.length
  }

  getDisplayName(): string {
    const aliveCount = this.getAliveCount()
    if (aliveCount <= 1) {
      return this.name
    }
    return `${this.name} x ${aliveCount}`
  }

  getAliveMembers(): readonly WizBattleMonster<TStatus, TCustom>[] {
    return this.members.filter((m) => m.isAlive())
  }

  getAliveMemberIds(): readonly string[] {
    return this.getAliveMembers().map((m) => m.id)
  }

  getActableMembers(): readonly WizBattleMonster<TStatus, TCustom>[] {
    return this.members.filter((m) => m.canAct())
  }

  getActableMemberIds(): readonly string[] {
    return this.getActableMembers().map((m) => m.id)
  }

  getMemberById(memberId: string): WizBattleMonster<TStatus, TCustom> | undefined {
    return this.members.find((m) => m.id === memberId)
  }

  requireMemberById(memberId: string): WizBattleMonster<TStatus, TCustom> {
    const member = this.getMemberById(memberId)
    if (!member) {
      throw new WizMonsterNotFoundError(memberId)
    }
    return member
  }

  withDamageToMember(memberId: string, amount: number): WizBattleMonsterGroup<TStatus, TCustom> {
    this.requireMemberById(memberId)
    const updatedMembers = this.members.map((m) => (m.id === memberId ? m.withDamage(amount) : m))
    return this.with({ members: updatedMembers })
  }

  withDamageToAll(amount: number): WizBattleMonsterGroup<TStatus, TCustom> {
    const updatedMembers = this.members.map((m) => (m.isAlive() ? m.withDamage(amount) : m))
    return this.with({ members: updatedMembers })
  }

  withHealToMember(memberId: string, amount: number): WizBattleMonsterGroup<TStatus, TCustom> {
    this.requireMemberById(memberId)
    const updatedMembers = this.members.map((m) => (m.id === memberId ? m.withHeal(amount) : m))
    return this.with({ members: updatedMembers })
  }

  withEffectToMember(memberId: string, effect: WizEffect): WizBattleMonsterGroup<TStatus, TCustom> {
    this.requireMemberById(memberId)
    const updatedMembers = this.members.map((m) => (m.id === memberId ? m.withEffect(effect) : m))
    return this.with({ members: updatedMembers })
  }

  withEffectToAll(effect: WizEffect): WizBattleMonsterGroup<TStatus, TCustom> {
    const updatedMembers = this.members.map((m) => (m.isAlive() ? m.withEffect(effect) : m))
    return this.with({ members: updatedMembers })
  }

  withMember(monster: WizBattleMonster<TStatus, TCustom>): WizBattleMonsterGroup<TStatus, TCustom> {
    const updatedMembers = this.members.map((m) => (m.id === monster.id ? monster : m))
    return this.with({ members: updatedMembers })
  }

  advanceEffects(): WizBattleMonsterGroup<TStatus, TCustom> {
    const updatedMembers = this.members.map((member) => member.advanceEffects())
    return this.with({ members: updatedMembers })
  }

  withReviveMember(
    memberId: string,
    hpPercentage: number,
  ): WizBattleMonsterGroup<TStatus, TCustom> {
    this.requireMemberById(memberId)
    const updatedMembers = this.members.map((m) =>
      m.id === memberId ? m.withRevive(hpPercentage) : m,
    )
    return this.with({ members: updatedMembers })
  }

  getDeadMembers(): readonly WizBattleMonster<TStatus, TCustom>[] {
    return this.members.filter((m) => m.isDead())
  }

  getDeadMemberIds(): readonly string[] {
    return this.getDeadMembers().map((m) => m.id)
  }

  isDefeated(): boolean {
    return this.getAliveCount() === 0
  }

  toProperties(): Properties<TStatus, TCustom> {
    return {
      id: this.id,
      name: this.name,
      members: this.members,
    }
  }
}
