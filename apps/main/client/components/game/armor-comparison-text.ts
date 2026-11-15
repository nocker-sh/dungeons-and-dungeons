import type { ArmorState } from "@/client/components/game/gear-text"

/** 受け取る仲間と、渡して防具を失う仲間の変化。数値はQueryで計算する。 */
export function armorComparisonText(
  comparison: {
    before: ArmorState
    after: ArmorState
    previousOwner?: {
      name: string
      before: ArmorState
      after: ArmorState
    } | null
  } | null,
  label = "着替え後"
) {
  if (!comparison) return ""
  const describe = (before: ArmorState, after: ArmorState, label: string) =>
    [
      `${label}：耐久 ${before.durability}/${before.maxDurability} → ${after.durability}/${after.maxDurability}`,
      ...(after.maxDurability > 0 && after.durability === 0
        ? ["着替え後は耐久切れ：ダメージを防げません。修理が必要です。"]
        : []),
      ...(before.hp !== after.hp || before.maxHp !== after.maxHp
        ? [
            `現在HP（生命力） ${before.hp}/${before.maxHp} → ${after.hp}/${after.maxHp}`,
          ]
        : []),
      ...(before.attack !== undefined &&
      after.attack !== undefined &&
      before.attack !== after.attack
        ? [`攻撃力 ${before.attack} → ${after.attack}`]
        : []),
      ...(
        [
          ["maxHp", "最大HP"],
          ["str", "筋力"],
          ["tec", "技量"],
          ["spd", "速さ"],
        ] as const
      )
        .filter(([key]) => before[key] !== after[key])
        .map(([key, label]) => `${label} ${before[key]} → ${after[key]}`),
    ].join("　")
  return [
    describe(comparison.before, comparison.after, label),
    comparison.previousOwner
      ? describe(
          comparison.previousOwner.before,
          comparison.previousOwner.after,
          `${comparison.previousOwner.name}は防具なしになる`
        )
      : "",
  ]
    .filter(Boolean)
    .join("　")
}
