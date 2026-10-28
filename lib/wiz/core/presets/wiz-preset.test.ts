import { describe, expect, it } from "vite-plus/test"
import { DEFAULT_DAMAGE_CONFIG } from "@/lib/wiz/core/config/battle/wiz-damage-config"
import { DEFAULT_FLEE_CONFIG } from "@/lib/wiz/core/config/battle/wiz-flee-config"
import { DEFAULT_REWARD_CONFIG } from "@/lib/wiz/core/config/battle/wiz-reward-config"
import { DEFAULT_EFFECT_CONFIG } from "@/lib/wiz/core/config/battle/wiz-effect-config"
import { DEFAULT_STATUS_CONVERSION_CONFIG } from "@/lib/wiz/core/config/battle/wiz-status-conversion-config"
import { DEFAULT_CONVERSATION_CONFIG } from "@/lib/wiz/core/config/conversation/wiz-conversation-config"
import { DEFAULT_EXPLORATION_PROBABILITY_CONFIG } from "@/lib/wiz/core/config/exploration/wiz-exploration-probability-config"
import { DEFAULT_LEVEL_UP_CONFIG } from "@/lib/wiz/core/config/level-up/wiz-level-up-config"
import { DEFAULT_TIME_CONFIG } from "@/lib/wiz/core/config/time/wiz-time-config"
import type { WizBattleMonster } from "@/lib/wiz/core/engine/battle/actors/monster"
import { WizEngineBattleDefaultRewardCalculator } from "@/lib/wiz/core/engine/reward/default-reward-calculator"
import { WizPresetValue } from "@/lib/wiz/core/presets/wiz-preset"
import { WizSceneBattleMonsterAdapter } from "@/lib/wiz/core/runtime/converters/battle-monster-adapter"
import type {
  WizBattleMonsterCustom,
  WizDefaultBattleStatus,
  WizTypes,
} from "@/lib/wiz/core/types/wiz-types"

type MagicTypes = WizTypes & {
  readonly BattleStatus: WizDefaultBattleStatus & {
    readonly magic: number
  }
}

type EssenceMonsterCustom = Readonly<{ essence: number }>

type EssenceTypes = WizTypes & {
  readonly BattleStatus: WizDefaultBattleStatus & {
    readonly magic: number
  }
  readonly BattleMonsterCustom: EssenceMonsterCustom
}

type Exact<TActual, TExpected> =
  (<T>() => T extends TActual ? 1 : 2) extends <T>() => T extends TExpected ? 1 : 2 ? true : false

type Expect<T extends true> = T

describe("WizPresetValue", () => {
  it("create()のデフォルトはフリーズされている", () => {
    const preset = WizPresetValue.create()

    expect(Object.isFrozen(preset)).toBe(true)
  })

  it("公開factoryを通らないprototype偽造とconstructor呼び出しを拒否する", () => {
    const forgedPreset = Object.create(WizPresetValue.prototype)
    const validPreset = WizPresetValue.create()

    expect(() => WizPresetValue.from(forgedPreset)).toThrow(
      "WizPresetValue instance was not created by its public factories",
    )
    expect(() => forgedPreset.with({})).toThrow(
      "WizPresetValue instance was not created by its public factories",
    )
    expect(() => Reflect.construct(WizPresetValue, [Symbol("forged"), validPreset])).toThrow(
      "WizPresetValue must be created with WizPresetValue.create() or from()",
    )
  })

  it("create()のデフォルトは全ての設定キーを持つ", () => {
    const preset = WizPresetValue.create()

    expect(preset.damage).toBeDefined()
    expect(preset.reward).toBeDefined()
    expect(preset.flee).toBeDefined()
    expect(preset.effect).toBeDefined()
    expect(preset.statusConversion).toBeDefined()
    expect(preset.levelUp).toBeDefined()
    expect(preset.conversation).toBeDefined()
    expect(preset.exploration).toBeDefined()
    expect(preset.time).toBeDefined()
  })

  it("create()のデフォルトは各デフォルト設定値と一致する", () => {
    const preset = WizPresetValue.create()

    expect(preset.damage).toEqual(DEFAULT_DAMAGE_CONFIG)
    expect(preset.reward).toEqual(DEFAULT_REWARD_CONFIG)
    expect(preset.flee).toEqual(DEFAULT_FLEE_CONFIG)
    expect(preset.effect).toEqual(DEFAULT_EFFECT_CONFIG)
    expect(preset.statusConversion).toEqual(DEFAULT_STATUS_CONVERSION_CONFIG)
    expect(preset.levelUp).toEqual(DEFAULT_LEVEL_UP_CONFIG)
    expect(preset.conversation).toEqual(DEFAULT_CONVERSATION_CONFIG)
    expect(preset.exploration).toEqual(DEFAULT_EXPLORATION_PROBABILITY_CONFIG)
    expect(preset.time).toEqual(DEFAULT_TIME_CONFIG)
  })

  it("create と with で元の値を変えずに派生プリセットを作る", () => {
    const preset = WizPresetValue.create({
      damage: { criticalChance: 0.1 },
    })
    const next = preset.with({
      damage: { criticalChance: 0.2 },
    })

    expect(preset.damage.criticalChance).toBe(0.1)
    expect(next.damage.criticalChance).toBe(0.2)
    expect(Object.isFrozen(next)).toBe(true)
    expect(Object.isFrozen(next.time.timeEffects)).toBe(true)
  })

  it("effect durationを部分overrideしてimmutableに保持する", () => {
    const preset = WizPresetValue.create({
      effect: {
        defaultBuffTurns: 8,
      },
    })
    const next = preset.with({
      effect: {
        defaultDebuffTurns: 5,
      },
    })

    expect(preset.effect.defaultBuffTurns).toBe(8)
    expect(preset.effect.defaultDebuffTurns).toBe(DEFAULT_EFFECT_CONFIG.defaultDebuffTurns)
    expect(next.effect.defaultBuffTurns).toBe(8)
    expect(next.effect.defaultDebuffTurns).toBe(5)
    expect(Object.isFrozen(next.effect)).toBe(true)
  })

  it("少ない設定でcustom BattleStatusを型安全に構成できる", () => {
    const preset = WizPresetValue.create<MagicTypes>({
      statusConversion: {
        customStatusFormula: (input) => ({
          magic: input.wisdom ?? 0,
        }),
      },
      damage: {
        damageFormula: (attacker, defender) => attacker.magic - defender.defense,
      },
    })

    expect(
      preset.statusConversion.customStatusFormula?.(
        {
          hp: 10,
          maxHp: 10,
          strength: 1,
          vitality: 1,
          agility: 1,
          wisdom: 8,
        },
        {
          hp: 10,
          maxHp: 10,
          mp: 0,
          maxMp: 0,
          attack: 1,
          defense: 1,
          speed: 1,
        },
      ),
    ).toEqual({ magic: 8 })
  })

  it("reward式へstatus customとmonster customを正確に推論して実行する", () => {
    const omittedMonsterCustomIsUnknown: Expect<
      Exact<WizBattleMonsterCustom<MagicTypes>, unknown>
    > = true
    const preset = WizPresetValue.create<EssenceTypes>({
      statusConversion: {
        customStatusFormula: () => ({ magic: 0 }),
      },
      reward: {
        expFormula: (monsters) => {
          const exactMonsterType: Expect<
            Exact<
              (typeof monsters)[number],
              WizBattleMonster<Readonly<{ magic: number }>, EssenceMonsterCustom>
            >
          > = true
          expect(exactMonsterType).toBe(true)
          return monsters.reduce(
            (total, monster) =>
              total + monster.custom.essence + monster.status.toFormulaView().magic,
            0,
          )
        },
        goldFormula: (monsters) =>
          monsters.reduce((total, monster) => total + monster.custom.essence, 0),
      },
    })
    const adapter = WizSceneBattleMonsterAdapter.defineWithMonsterCustom({
      statusCustom: () => ({ magic: 3 }),
      monsterCustom: (_monster, standard): EssenceMonsterCustom => ({
        essence: standard.expReward * 2,
      }),
    })
    const enemies = adapter.enemiesFromMonsters([
      {
        id: "wisp",
        name: "Wisp",
        hp: 8,
        maxHp: 8,
        attack: 2,
        defense: 1,
        agility: 5,
        expReward: 7,
        goldReward: 4,
        drops: [],
      },
    ])
    const calculator = new WizEngineBattleDefaultRewardCalculator<
      Readonly<{ magic: number }>,
      EssenceMonsterCustom
    >({
      config: preset.reward,
    })

    const reward = calculator.calculate({ enemies })

    expect(omittedMonsterCustomIsUnknown).toBe(true)
    expect(reward.experience).toBe(17)
    expect(reward.gold).toBe(14)
  })

  it("custom BattleStatusではstatus conversionの指定が必須になる", () => {
    const createInvalidPreset = () =>
      // @ts-expect-error custom BattleStatusを生成するformulaが必要
      WizPresetValue.create<MagicTypes>({
        damage: {
          damageFormula: (attacker) => attacker.magic,
        },
      })

    expect(createInvalidPreset).toBeTypeOf("function")
  })
})
