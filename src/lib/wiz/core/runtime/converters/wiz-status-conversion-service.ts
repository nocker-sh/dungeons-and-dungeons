import {
  DEFAULT_STATUS_CONVERSION_CONFIG,
  type WizStatusConversionInput,
  type WizStatusConversionConfig,
} from "@/lib/wiz/core/config/battle/wiz-status-conversion-config"
import { immutableConfig } from "@/lib/wiz/core/config/immutable-config"
import { WizBattleActorState } from "@/lib/wiz/core/engine/battle/actor-state"
import type {
  WizBattleStatusBase,
  WizBattleStatusCustom,
  WizDefaultBattleStatus,
} from "@/lib/wiz/core/types/wiz-types"
import {
  assertFiniteNumberValue,
  assertFiniteNumericFields,
  assertRecordValue,
} from "@/lib/wiz/core/value-validation"

const STANDARD_STATUS_KEYS = new Set(["hp", "maxHp", "mp", "maxMp", "attack", "defense", "speed"])
const authenticStatusConversionServices = new WeakSet<object>()

const STATUS_CONVERSION_NUMBER_KEYS = [
  "attackBase",
  "attackPerStrength",
  "defenseBase",
  "defensePerVitality",
  "speedBase",
  "speedPerAgility",
  "maxHpBase",
  "maxHpPerVitality",
  "maxMpBase",
  "maxMpPerWisdom",
] as const

const STATUS_CONVERSION_FORMULA_KEYS = [
  "attackFormula",
  "defenseFormula",
  "speedFormula",
  "battleStatusFormula",
  "customStatusFormula",
] as const

const readConfigDataProperty = (config: object, key: string): unknown => {
  const descriptor = Object.getOwnPropertyDescriptor(config, key)
  if (descriptor === undefined || !("value" in descriptor)) {
    return undefined
  }
  return descriptor.value
}

const assertStatusConversionConfig = (config: unknown): void => {
  assertRecordValue("status-conversion", "config", config)
  for (const key of STATUS_CONVERSION_NUMBER_KEYS) {
    assertFiniteNumberValue(
      "status-conversion",
      `config.${key}`,
      readConfigDataProperty(config, key),
    )
  }
  for (const key of STATUS_CONVERSION_FORMULA_KEYS) {
    const formula = readConfigDataProperty(config, key)
    if (formula !== undefined && typeof formula !== "function") {
      throw new TypeError(`Status conversion config.${key} must be a function when provided`)
    }
  }
}

/**
 * プレイヤーの能力値から戦闘ステータスへの変換サービス
 *
 * 計算式:
 * - attack = attackBase + strength * attackPerStrength
 * - defense = defenseBase + vitality * defensePerVitality
 * - speed = speedBase + agility * speedPerAgility
 */
export class WizSceneBattleStatusConversionService<
  TBattleStatus extends WizBattleStatusBase = WizDefaultBattleStatus,
> {
  private readonly config: WizStatusConversionConfig<TBattleStatus>

  constructor(config: WizStatusConversionConfig<TBattleStatus>) {
    assertStatusConversionConfig(config)
    this.config = immutableConfig(config)
    authenticStatusConversionServices.add(this)
    Object.freeze(this)
  }

  static createDefault(): WizSceneBattleStatusConversionService<WizDefaultBattleStatus> {
    return new WizSceneBattleStatusConversionService(DEFAULT_STATUS_CONVERSION_CONFIG)
  }

  static assertAuthentic(service: object): void {
    if (!authenticStatusConversionServices.has(service)) {
      throw new TypeError(
        "WizSceneBattleStatusConversionService instance was not created by its constructor",
      )
    }
  }

  /**
   * プレイヤーの能力値から戦闘ステータスを生成
   */
  convert(
    input: WizStatusConversionInput,
  ): WizBattleActorState<WizBattleStatusCustom<TBattleStatus>> {
    this.assertInput(input)
    const base = this.createBaseStatus(input)

    if (this.config.battleStatusFormula) {
      const battleStatus = this.config.battleStatusFormula(input, base)
      assertRecordValue("status-conversion", "battleStatusFormula", battleStatus)
      return this.createStatusFromBattleView(battleStatus, base)
    }

    const custom = this.config.customStatusFormula
      ? this.config.customStatusFormula(input, base)
      : (Object.freeze({}) as WizBattleStatusCustom<TBattleStatus>)
    assertRecordValue("status-conversion", "customStatusFormula", custom)
    assertFiniteNumericFields("status-conversion", "customStatusFormula", custom)

    return this.createStatus(base, custom)
  }

  private createBaseStatus(input: WizStatusConversionInput): WizDefaultBattleStatus {
    return Object.freeze({
      hp: input.hp,
      maxHp: input.maxHp,
      mp: input.mp === undefined ? 0 : input.mp,
      maxMp: input.maxMp === undefined ? 0 : input.maxMp,
      attack: this.calculateAttack(input.strength, input),
      defense: this.calculateDefense(input.vitality, input),
      speed: this.calculateSpeed(input.agility, input),
    })
  }

  private createStatus<TCustom>(
    base: WizDefaultBattleStatus,
    custom: TCustom,
  ): WizBattleActorState<TCustom> {
    return WizBattleActorState.create({
      attributes: {
        attack: base.attack,
        defense: base.defense,
        speed: base.speed,
      },
      resources: {
        health: { current: base.hp, maximum: base.maxHp },
        mana: { current: base.mp, maximum: base.maxMp },
      },
      custom,
    })
  }

  private createStatusFromBattleView(
    battleStatus: TBattleStatus,
    fallback: WizDefaultBattleStatus,
  ): WizBattleActorState<WizBattleStatusCustom<TBattleStatus>> {
    assertFiniteNumberValue("status-conversion", "battleStatusFormula.maxHp", battleStatus.maxHp, {
      minimum: 0,
    })
    assertFiniteNumberValue("status-conversion", "battleStatusFormula.hp", battleStatus.hp, {
      maximum: battleStatus.maxHp,
      minimum: 0,
    })
    assertFiniteNumberValue(
      "status-conversion",
      "battleStatusFormula.attack",
      battleStatus.attack,
      { minimum: 0 },
    )
    assertFiniteNumberValue(
      "status-conversion",
      "battleStatusFormula.defense",
      battleStatus.defense,
      { minimum: 0 },
    )
    assertFiniteNumberValue("status-conversion", "battleStatusFormula.speed", battleStatus.speed, {
      minimum: 0,
    })

    const entries = Object.entries(battleStatus).filter(([key]) => !STANDARD_STATUS_KEYS.has(key))
    const custom = Object.freeze(
      Object.fromEntries(entries),
    ) as WizBattleStatusCustom<TBattleStatus>
    assertFiniteNumericFields("status-conversion", "battleStatusFormula.custom", custom)
    const optionalStandard = battleStatus as TBattleStatus &
      Partial<Pick<WizDefaultBattleStatus, "mp" | "maxMp">>
    const maxMp = optionalStandard.maxMp === undefined ? fallback.maxMp : optionalStandard.maxMp
    const mp = optionalStandard.mp === undefined ? fallback.mp : optionalStandard.mp
    assertFiniteNumberValue("status-conversion", "battleStatusFormula.maxMp", maxMp, {
      minimum: 0,
    })
    assertFiniteNumberValue("status-conversion", "battleStatusFormula.mp", mp, {
      maximum: maxMp,
      minimum: 0,
    })

    return WizBattleActorState.create({
      attributes: {
        attack: battleStatus.attack,
        defense: battleStatus.defense,
        speed: battleStatus.speed,
      },
      resources: {
        health: { current: battleStatus.hp, maximum: battleStatus.maxHp },
        mana: { current: mp, maximum: maxMp },
      },
      custom,
    })
  }

  /**
   * 攻撃力を計算 (プレビュー用)
   *
   * `WizStatusConversionConfig.attackFormula` が設定されていればそれを優先する。
   */
  calculateAttack(strength: number, input?: WizStatusConversionInput): number {
    assertFiniteNumberValue("status-conversion", "strength", strength)
    const c = this.config
    let attack: number
    if (c.attackFormula && input) {
      this.assertInput(input)
      attack = c.attackFormula(input)
      assertFiniteNumberValue("status-conversion", "attackFormula", attack, {
        minimum: 0,
      })
      return attack
    }
    attack = c.attackBase + strength * c.attackPerStrength
    assertFiniteNumberValue("status-conversion", "attack", attack, {
      minimum: 0,
    })
    return attack
  }

  /**
   * 防御力を計算 (プレビュー用)
   *
   * `WizStatusConversionConfig.defenseFormula` が設定されていればそれを優先する。
   */
  calculateDefense(vitality: number, input?: WizStatusConversionInput): number {
    assertFiniteNumberValue("status-conversion", "vitality", vitality)
    const c = this.config
    let defense: number
    if (c.defenseFormula && input) {
      this.assertInput(input)
      defense = c.defenseFormula(input)
      assertFiniteNumberValue("status-conversion", "defenseFormula", defense, {
        minimum: 0,
      })
      return defense
    }
    defense = c.defenseBase + vitality * c.defensePerVitality
    assertFiniteNumberValue("status-conversion", "defense", defense, {
      minimum: 0,
    })
    return defense
  }

  /**
   * 速度を計算 (プレビュー用)
   *
   * `WizStatusConversionConfig.speedFormula` が設定されていればそれを優先する。
   */
  calculateSpeed(agility: number, input?: WizStatusConversionInput): number {
    assertFiniteNumberValue("status-conversion", "agility", agility)
    const c = this.config
    let speed: number
    if (c.speedFormula && input) {
      this.assertInput(input)
      speed = c.speedFormula(input)
      assertFiniteNumberValue("status-conversion", "speedFormula", speed, {
        minimum: 0,
      })
      return speed
    }
    speed = c.speedBase + agility * c.speedPerAgility
    assertFiniteNumberValue("status-conversion", "speed", speed, {
      minimum: 0,
    })
    return speed
  }

  private assertInput(input: WizStatusConversionInput): void {
    assertRecordValue("status-conversion", "input", input)
    assertFiniteNumberValue("status-conversion", "input.maxHp", input.maxHp, {
      minimum: 0,
    })
    assertFiniteNumberValue("status-conversion", "input.hp", input.hp, {
      maximum: input.maxHp,
      minimum: 0,
    })
    const maxMp = input.maxMp === undefined ? 0 : input.maxMp
    const mp = input.mp === undefined ? 0 : input.mp
    assertFiniteNumberValue("status-conversion", "input.maxMp", maxMp, {
      minimum: 0,
    })
    assertFiniteNumberValue("status-conversion", "input.mp", mp, {
      maximum: maxMp,
      minimum: 0,
    })
    assertFiniteNumberValue("status-conversion", "input.strength", input.strength)
    assertFiniteNumberValue("status-conversion", "input.vitality", input.vitality)
    assertFiniteNumberValue("status-conversion", "input.agility", input.agility)
    if (input.wisdom !== undefined) {
      assertFiniteNumberValue("status-conversion", "input.wisdom", input.wisdom)
    }
    if (input.customAttributes !== undefined) {
      assertRecordValue("status-conversion", "input.customAttributes", input.customAttributes)
      assertFiniteNumericFields(
        "status-conversion",
        "input.customAttributes",
        input.customAttributes,
      )
    }
  }
}

Object.freeze(WizSceneBattleStatusConversionService)
Object.freeze(WizSceneBattleStatusConversionService.prototype)
