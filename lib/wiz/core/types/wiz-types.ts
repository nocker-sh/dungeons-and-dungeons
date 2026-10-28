/**
 * open-wiz で使用する型を集約した型セット
 *
 * 開発者はこれを拡張して自分のプロジェクト用の型を定義する
 */
export type WizTypes = {
  /** damage/evasion formula に渡す完全な戦闘ステータスview型 */
  readonly BattleStatus: WizBattleStatusBase
  /**
   * battle中のmonster固有data。
   *
   * 未指定の型セットでは`unknown`として扱い、明示したworldだけがcustom dataへ安全に触れる。
   */
  readonly BattleMonsterCustom?: unknown
}

/** 戦闘ステータスの最小構成 (これを満たせば動く) */
export type WizBattleStatusBase = {
  readonly attack: number
  readonly defense: number
  readonly speed: number
  readonly hp: number
  readonly maxHp: number
}

/** デフォルトの型セット */
export type WizDefaultTypes = {
  readonly BattleStatus: WizDefaultBattleStatus
  readonly BattleMonsterCustom: WizDefaultBattleMonsterCustom
}

/** デフォルトの戦闘ステータス */
export type WizDefaultBattleStatus = WizBattleStatusBase & {
  readonly mp: number
  readonly maxMp: number
}

/** 標準monster adapterがbattle actorへ保持する報酬data。 */
export type WizDefaultBattleMonsterCustom = Readonly<{
  readonly expReward: number
  readonly goldReward: number
  readonly drops: readonly Readonly<{
    readonly itemId: string
    readonly chance: number
  }>[]
}>

/**
 * 型セットからmonster固有dataを取り出す。
 *
 * `WizTypes & { BattleStatus: ... }`のように軸を省略した型セットは`unknown`を維持する。
 */
export type WizBattleMonsterCustom<TTypes extends WizTypes> =
  TTypes extends Readonly<{ BattleMonsterCustom: infer TCustom }> ? TCustom : unknown

/**
 * 内部statusのcustom fieldsを標準fieldと合成した、formula向けの完全なview。
 *
 * `WizBattleActorState<TCustom>` は内部表現、`WizBattleStatusView<TCustom>` は公開計算式の入力として使う。
 */
export type WizBattleStatusView<TCustom = Record<string, never>> = Readonly<
  WizDefaultBattleStatus &
    Omit<TCustom extends object ? TCustom : Record<string, never>, keyof WizDefaultBattleStatus>
>

/** 完全な戦闘ステータス型から、内部statusに保持するcustom fieldsだけを取り出す。 */
export type WizBattleStatusCustom<TBattleStatus extends WizBattleStatusBase> = Readonly<
  Omit<TBattleStatus, keyof WizDefaultBattleStatus>
>
