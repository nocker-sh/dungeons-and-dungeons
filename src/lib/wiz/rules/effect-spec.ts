import type { MagicSchool, Reach, StatusKind, Target } from "@/lib/wiz/content"

/** ワザと道具を同じ形にした効果の仕様。戦闘の計算はこの形だけを見る。 */
export type EffectSpec = {
  kind: "hit" | "heal" | "support"
  power: number
  drain?: number
  bonusAgainst?: { readonly status: StatusKind; readonly factor: number }
  target: Target
  status?: {
    readonly kind: StatusKind
    readonly turns: number
    readonly chance?: number
  }
  cure?: readonly StatusKind[]
  revive?: boolean
  reach?: Reach
  /** 固定の量（道具）。 */
  amount?: number
  /** 道具で戻すワザの使用回数。 */
  refill?: number
  /** 味方の防具の耐久を戻す量。 */
  repair?: number
  /** 魔法の流派（流派のないワザは undefined）。 */
  school?: MagicSchool
  /** 放つ前に自分が払う最大HPの割合（悪魔の流派）。 */
  sacrifice?: number
}
