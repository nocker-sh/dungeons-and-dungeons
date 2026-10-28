export type Bonus = Partial<Record<"str" | "tec" | "spd" | "maxHp", number>>

/** 防具の良さの目安。耐久は1点＝HP1点ぶんとして控えめに数える。 */
export function worth(bonus: Bonus | undefined, durability = 0) {
  return (
    durability * 0.15 +
    (bonus?.str ?? 0) * 1.2 +
    (bonus?.tec ?? 0) * 1.2 +
    (bonus?.spd ?? 0) * 0.6 +
    (bonus?.maxHp ?? 0) * 0.15
  )
}
