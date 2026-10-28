import type { WeaponInfo } from "@/client/components/game/gear-text"
import { shortText } from "@/client/components/game/short-text"

export type Fit = {
  attack: number
  met: boolean
  short: { str: number; tec: number }
  favorite: boolean
}

/** ランダムに入ったワザに付ける印。 */
export const RANDOM_SKILL_MARK = "＊"

/**
 * 一覧に出す説明。武器なら付くワザ4つと、その仲間が持ったときの攻撃力・不足を添える。
 * この個体だけのワザには印を付ける。fit を渡さなければ武器そのものの説明だけ。
 */
export function gearDesc(
  entry: {
    desc: string
    weapon: WeaponInfo | null
    allowedJobs?: readonly string[] | null
  },
  fit?: Fit | null
) {
  if (!entry.weapon)
    return [
      entry.desc,
      entry.allowedJobs
        ? `装備できる職業：${entry.allowedJobs.join("・")}`
        : "",
    ]
      .filter(Boolean)
      .join("　")
  const skills = entry.weapon.skills
  const parts = [
    `ワザ：${skills
      .map(
        (skill) =>
          `${skill.random ? RANDOM_SKILL_MARK : ""}${skill.name}（${skill.uses ?? 0}回）`
      )
      .join("・")}`,
  ]
  if (skills.some((skill) => skill.random))
    parts.push(`${RANDOM_SKILL_MARK}はこの個体だけのワザ`)
  if (fit) {
    parts.unshift(
      `${fit.favorite ? "得意" : "得意でない"}・攻撃力 ${fit.attack}`
    )
    const short = shortText(fit.short)
    if (short) parts.push(short)
  }
  return parts.join("　")
}
