import type { WizEffect } from "@/lib/wiz/core/domain/values/effect-set"
import {
  WizCharacterNotFoundError,
  WizEmptyPartyError,
} from "@/lib/wiz/core/errors"
import type { WizBattleCharacter } from "@/lib/wiz/core/engine/battle/actors/character"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"

type Properties<TStatus = unknown, TCustom = unknown> = {
  readonly id: string
  readonly members: readonly WizBattleCharacter<TStatus, TCustom>[]
}

export class WizBattleParty<TStatus = unknown, TCustom = unknown> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly id: string
  readonly members: readonly WizBattleCharacter<TStatus, TCustom>[]

  constructor(properties: Properties<TStatus, TCustom>) {
    if (properties.members.length === 0) {
      throw new WizEmptyPartyError()
    }
    this.id = properties.id
    this.members = Object.freeze([...properties.members])
    WizImmutableValue.freeze(this)
  }

  private with(
    overrides: Partial<Properties<TStatus, TCustom>>
  ): WizBattleParty<TStatus, TCustom> {
    return new WizBattleParty({ ...this.toProperties(), ...overrides })
  }

  getAliveCount(): number {
    return this.members.filter((m) => m.isAlive()).length
  }

  getTotalCount(): number {
    return this.members.length
  }

  getAliveMembers(): readonly WizBattleCharacter<TStatus, TCustom>[] {
    return this.members.filter((m) => m.isAlive())
  }

  getAliveMemberIds(): readonly string[] {
    return this.getAliveMembers().map((m) => m.id)
  }

  getMemberById(
    memberId: string
  ): WizBattleCharacter<TStatus, TCustom> | undefined {
    return this.members.find((m) => m.id === memberId)
  }

  requireMemberById(memberId: string): WizBattleCharacter<TStatus, TCustom> {
    const member = this.getMemberById(memberId)
    if (!member) {
      throw new WizCharacterNotFoundError(memberId)
    }
    return member
  }

  getMemberByIndex(
    index: number
  ): WizBattleCharacter<TStatus, TCustom> | undefined {
    return this.members[index]
  }

  getActableMembers(): readonly WizBattleCharacter<TStatus, TCustom>[] {
    return this.members.filter((m) => m.canAct())
  }

  withDamageToMember(
    memberId: string,
    amount: number
  ): WizBattleParty<TStatus, TCustom> {
    this.requireMemberById(memberId)
    const updatedMembers = this.members.map((m) =>
      m.id === memberId ? m.withDamage(amount) : m
    )
    return this.with({ members: updatedMembers })
  }

  withHealToMember(
    memberId: string,
    amount: number
  ): WizBattleParty<TStatus, TCustom> {
    this.requireMemberById(memberId)
    const updatedMembers = this.members.map((m) =>
      m.id === memberId ? m.withHeal(amount) : m
    )
    return this.with({ members: updatedMembers })
  }

  withEffectToMember(
    memberId: string,
    effect: WizEffect
  ): WizBattleParty<TStatus, TCustom> {
    this.requireMemberById(memberId)
    const updatedMembers = this.members.map((m) =>
      m.id === memberId ? m.withEffect(effect) : m
    )
    return this.with({ members: updatedMembers })
  }

  withMember(
    character: WizBattleCharacter<TStatus, TCustom>
  ): WizBattleParty<TStatus, TCustom> {
    const updatedMembers = this.members.map((m) =>
      m.id === character.id ? character : m
    )
    return this.with({ members: updatedMembers })
  }

  advanceEffects(): WizBattleParty<TStatus, TCustom> {
    const updatedMembers = this.members.map((member) => member.advanceEffects())
    return this.with({ members: updatedMembers })
  }

  withReviveMember(
    memberId: string,
    hpPercentage: number
  ): WizBattleParty<TStatus, TCustom> {
    this.requireMemberById(memberId)
    const updatedMembers = this.members.map((m) =>
      m.id === memberId ? m.withRevive(hpPercentage) : m
    )
    return this.with({ members: updatedMembers })
  }

  getDeadMembers(): readonly WizBattleCharacter<TStatus, TCustom>[] {
    return this.members.filter((m) => m.isDead())
  }

  getDeadMemberIds(): readonly string[] {
    return this.getDeadMembers().map((m) => m.id)
  }

  getFledMembers(): readonly WizBattleCharacter<TStatus, TCustom>[] {
    return this.members.filter((m) => m.hasFled())
  }

  getFledMemberIds(): readonly string[] {
    return this.getFledMembers().map((m) => m.id)
  }

  hasAllLivingMembersFled(): boolean {
    const livingMembers = this.getAliveMembers()
    return (
      livingMembers.length > 0 &&
      livingMembers.every((member) => member.hasFled())
    )
  }

  getInBattleMembers(): readonly WizBattleCharacter<TStatus, TCustom>[] {
    return this.members.filter((m) => m.isInBattle())
  }

  getInBattleCount(): number {
    return this.getInBattleMembers().length
  }

  isDefeated(): boolean {
    // 全員が死亡または逃走したら敗北
    return this.getInBattleCount() === 0
  }

  toProperties(): Properties<TStatus, TCustom> {
    return {
      id: this.id,
      members: this.members,
    }
  }
}
