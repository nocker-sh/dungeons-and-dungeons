import type { WizBattleActorState } from "@/lib/wiz/core/engine/battle/actor-state"
import {
  WizEffect,
  WizEffectSet,
} from "@/lib/wiz/core/domain/values/effect-set"
import { WIZ_BATTLE_EFFECT_TAG } from "@/lib/wiz/core/engine/battle/standard-tags"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"

const objectService = new WizObjectService()

type Properties<TStatus = unknown, TCustom = unknown> = {
  readonly id: string
  readonly name: string
  readonly custom: TCustom | WizDeepReadonly<TCustom>
  readonly status: WizBattleActorState<TStatus>
  readonly effects: WizEffectSet
}

export class WizBattleCharacter<TStatus = unknown, TCustom = unknown> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly id: string
  readonly name: string
  readonly custom: WizDeepReadonly<TCustom>
  readonly status: WizBattleActorState<TStatus>
  readonly effects: WizEffectSet

  constructor(properties: Properties<TStatus, TCustom>) {
    this.id = properties.id
    this.name = properties.name
    this.custom = objectService.ownImmutable<TCustom>(properties.custom)
    this.status = properties.status
    WizEffectSet.require(properties.effects, "Character effects")
    this.effects = properties.effects
    WizImmutableValue.freeze(this)
  }

  private with(
    overrides: Partial<Properties<TStatus, TCustom>>
  ): WizBattleCharacter<TStatus, TCustom> {
    return new WizBattleCharacter({ ...this.toProperties(), ...overrides })
  }

  withStatus(
    status: WizBattleActorState<TStatus>
  ): WizBattleCharacter<TStatus, TCustom> {
    return this.with({ status })
  }

  withDamage(amount: number): WizBattleCharacter<TStatus, TCustom> {
    return this.withStatus(this.status.takeDamage(amount))
  }

  withHeal(amount: number): WizBattleCharacter<TStatus, TCustom> {
    return this.withStatus(this.status.restoreHealth(amount))
  }

  withEffect(effect: WizEffect): WizBattleCharacter<TStatus, TCustom> {
    return this.with({ effects: this.effects.apply(effect) })
  }

  withoutEffect(instanceId: string): WizBattleCharacter<TStatus, TCustom> {
    return this.with({ effects: this.effects.remove(instanceId) })
  }

  advanceEffects(): WizBattleCharacter<TStatus, TCustom> {
    return this.with({ effects: this.effects.advanceTurn() })
  }

  clearEffects(): WizBattleCharacter<TStatus, TCustom> {
    return this.with({ effects: WizEffectSet.create() })
  }

  isAlive(): boolean {
    return this.status.isAlive()
  }

  canAct(): boolean {
    if (!this.isAlive()) {
      return false
    }
    return !this.effects.effects.some((effect) =>
      effect.tags.includes(WIZ_BATTLE_EFFECT_TAG.blocksAction)
    )
  }

  hasEffect(effectId: string): boolean {
    return this.effects.effects.some((effect) => effect.effectId === effectId)
  }

  hasMp(amount: number): boolean {
    return this.status.hasMana(amount)
  }

  withMpCost(amount: number): WizBattleCharacter<TStatus, TCustom> {
    return this.withStatus(this.status.spendMana(amount))
  }

  withMpRestore(amount: number): WizBattleCharacter<TStatus, TCustom> {
    return this.withStatus(this.status.restoreMana(amount))
  }

  isDefending(): boolean {
    return this.effects.effects.some((effect) =>
      effect.tags.includes(WIZ_BATTLE_EFFECT_TAG.defending)
    )
  }

  isSilenced(): boolean {
    return this.effects.effects.some((effect) =>
      effect.tags.includes(WIZ_BATTLE_EFFECT_TAG.silenced)
    )
  }

  getDefenseMultiplier(defenseMultiplierWhenDefending: number = 2.0): number {
    return this.isDefending() ? defenseMultiplierWhenDefending : 1.0
  }

  withRevive(hpPercentage: number): WizBattleCharacter<TStatus, TCustom> {
    const revivedHp = Math.floor(
      this.status.resources.maximum("health") * hpPercentage
    )
    const revivedStatus = this.status.withHealth(Math.max(1, revivedHp))
    return this.with({
      status: revivedStatus,
      effects: this.effects.removeTag(WIZ_BATTLE_EFFECT_TAG.dead),
    })
  }

  isDead(): boolean {
    return !this.isAlive()
  }

  hasFled(): boolean {
    return this.effects.effects.some((effect) =>
      effect.tags.includes(WIZ_BATTLE_EFFECT_TAG.fled)
    )
  }

  isInBattle(): boolean {
    return this.isAlive() && !this.hasFled()
  }

  toProperties(): Properties<TStatus, TCustom> {
    return {
      id: this.id,
      name: this.name,
      custom: this.custom,
      status: this.status,
      effects: this.effects,
    }
  }
}
