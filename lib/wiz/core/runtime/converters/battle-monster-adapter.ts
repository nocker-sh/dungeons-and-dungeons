import { WizBattleEnemyParty } from "@/lib/wiz/core/engine/battle/actors/enemy-party"
import { WizBattleMonster } from "@/lib/wiz/core/engine/battle/actors/monster"
import { WizEffectSet } from "@/lib/wiz/core/domain/values/effect-set"
import { WizBattleMonsterGroup } from "@/lib/wiz/core/engine/battle/actors/monster-group"
import { WizBattleActorState } from "@/lib/wiz/core/engine/battle/actor-state"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import type { WizDefaultBattleMonsterCustom } from "@/lib/wiz/core/types/wiz-types"
import type { WizVaultMonsterState } from "@/lib/wiz/core/vault/states/monster/schema"

type WizBattleMonsterInput = WizDeepReadonly<WizVaultMonsterState>

const createDefaultMonsterCustom = (monster: WizBattleMonsterInput) => ({
  expReward: monster.expReward,
  goldReward: monster.goldReward,
  drops: monster.drops,
})

export type WizSceneBattleMonsterAuthority<
  TStatus = unknown,
  TCustom = unknown,
> = Readonly<{
  readonly enemiesFromMonsters: (
    monsters: readonly WizBattleMonsterInput[]
  ) => WizBattleEnemyParty<TStatus, TCustom>
}>

export type WizSceneBattleMonsterAdapterDefinition<TStatus> = Readonly<{
  readonly statusCustom: (monster: WizBattleMonsterInput) => TStatus
}>

export type WizSceneBattleMonsterCustomAdapterDefinition<TStatus, TCustom> =
  WizSceneBattleMonsterAdapterDefinition<TStatus> &
    Readonly<{
      readonly monsterCustom: (
        monster: WizBattleMonsterInput,
        standard: WizDefaultBattleMonsterCustom
      ) => TCustom
    }>

type WizSceneBattleMonsterCustomFactory<TCustom> = (
  monster: WizBattleMonsterInput,
  standard: WizDefaultBattleMonsterCustom
) => TCustom

/**
 * vault monsterをbattle actorへ変換する唯一のauthority。
 *
 * custom battle statusを使うworldは`define()`で全monsterの必須fieldを生成する。
 * 標準報酬dataはmonster customへ既定で保持される。
 */
export class WizSceneBattleMonsterAdapter<
  TStatus,
  TCustom = WizDefaultBattleMonsterCustom,
> implements WizSceneBattleMonsterAuthority<TStatus, TCustom> {
  readonly #statusCustom: (monster: WizBattleMonsterInput) => TStatus
  readonly #monsterCustom: WizSceneBattleMonsterCustomFactory<TCustom>

  private constructor(
    statusCustom: (monster: WizBattleMonsterInput) => TStatus,
    monsterCustom: WizSceneBattleMonsterCustomFactory<TCustom>
  ) {
    this.#statusCustom = statusCustom
    this.#monsterCustom = monsterCustom
    Object.freeze(this)
  }

  static createDefault(): WizSceneBattleMonsterAdapter<
    Record<string, never>,
    WizDefaultBattleMonsterCustom
  > {
    return new WizSceneBattleMonsterAdapter(
      () => Object.freeze({}),
      (_monster, standard) => standard
    )
  }

  static define<const TStatus>(
    definition: WizSceneBattleMonsterAdapterDefinition<TStatus>
  ): WizSceneBattleMonsterAdapter<TStatus, WizDefaultBattleMonsterCustom> {
    return new WizSceneBattleMonsterAdapter(
      definition.statusCustom,
      (_monster, standard) => standard
    )
  }

  static defineWithMonsterCustom<const TStatus, const TCustom>(
    definition: WizSceneBattleMonsterCustomAdapterDefinition<TStatus, TCustom>
  ): WizSceneBattleMonsterAdapter<TStatus, TCustom> {
    return new WizSceneBattleMonsterAdapter(
      definition.statusCustom,
      definition.monsterCustom
    )
  }

  fromMonster(
    monster: WizBattleMonsterInput,
    index = 0
  ): WizBattleMonster<TStatus, TCustom> {
    const standard = createDefaultMonsterCustom(monster)
    return new WizBattleMonster({
      id: `${monster.id}_${index}`,
      name: monster.name,
      custom: this.#monsterCustom(monster, standard),
      status: WizBattleActorState.create({
        attributes: {
          attack: monster.attack,
          defense: monster.defense,
          speed: monster.agility,
        },
        resources: {
          health: { current: monster.hp, maximum: monster.maxHp },
          mana: { current: 0, maximum: 0 },
        },
        custom: this.#statusCustom(monster),
      }),
      effects: WizEffectSet.create(),
      groupId: monster.id,
    })
  }

  readonly enemiesFromMonsters = (
    monsters: readonly WizBattleMonsterInput[]
  ): WizBattleEnemyParty<TStatus, TCustom> => {
    const groupMap = new Map<
      string,
      { monster: WizBattleMonsterInput; count: number }
    >()

    for (const monster of monsters) {
      const existing = groupMap.get(monster.id)
      if (existing) {
        existing.count += 1
      } else {
        groupMap.set(monster.id, { monster, count: 1 })
      }
    }

    const groups: WizBattleMonsterGroup<TStatus, TCustom>[] = []
    let globalIndex = 0

    for (const { monster, count } of groupMap.values()) {
      const members: WizBattleMonster<TStatus, TCustom>[] = []
      for (let index = 0; index < count; index += 1) {
        members.push(this.fromMonster(monster, globalIndex))
        globalIndex += 1
      }
      groups.push(
        new WizBattleMonsterGroup({
          id: monster.id,
          name: monster.name,
          members,
        })
      )
    }

    return new WizBattleEnemyParty({
      id: "enemies",
      groups,
    })
  }
}

Object.freeze(WizSceneBattleMonsterAdapter.prototype)
Object.freeze(WizSceneBattleMonsterAdapter)
