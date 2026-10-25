import { type GoodDef, type StatusKind } from "@/lib/wiz/content"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"

/** 装備している防具の個体と耐久。 */
export type EquippedArmor = Readonly<{
  /** 装備の個体 id。 */
  gear: string
  good: WizDeepReadonly<GoodDef>
  plus: number
  /** 減っている耐久。 */
  wear: number
  /** 強化を含む最大の耐久。 */
  maxDurability: number
  /** 今の耐久。 */
  durability: number
}>

/** 合体の効果。契約している悪魔のレベルで決まり、主人公だけに乗る。 */
export type FusionBonus = Readonly<{
  /** 攻撃力の倍率（1 なら効果なし）。 */
  attack: number
  /** 増える最大HP。 */
  maxHp: number
  /** 状態異常への耐性（0〜1）。 */
  resist: Readonly<Partial<Record<StatusKind, number>>>
}>
