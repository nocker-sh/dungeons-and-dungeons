import type { GameQueries } from "@/lib/wiz/queries/game-queries"

type Fusion = NonNullable<ReturnType<GameQueries["demons"]>[number]["fusion"]>

/** 合体先の選択・仲間の詳細・戦闘で同じ効果を案内する。 */
export function fusionText(fusion: Fusion, attackLabel = "攻撃力") {
  return [
    fusion.attackPercent ? `${attackLabel} +${fusion.attackPercent}%` : null,
    fusion.maxHp ? `HP +${fusion.maxHp}` : null,
    ...fusion.resist.map((entry) =>
      entry.immune ? entry.label : `${entry.name}耐性 ${entry.percent}%`
    ),
  ]
    .filter(Boolean)
    .join("・")
}
