import type { WeaponInfo, ArmorState } from "@/client/components/game/gear-text"
import { gearDesc } from "@/client/components/game/gear-desc"
import { shortText } from "@/client/components/game/short-text"
import { armorComparisonText } from "@/client/components/game/armor-comparison-text"

/** 鑑定前の収集目標。個体の追加ワザやレア度を確定したものとして示さない。 */
export function gearGoalDesc(entry: {
  desc: string
  weapon: WeaponInfo | null
  allowedJobs?: readonly string[] | null
  equipMembers?: readonly {
    name: string
    short?: { str: number; tec: number } | null
    currentArmor?: { name: string; stat: string } | null
    armorComparison?: { before: ArmorState; after: ArmorState } | null
    attackComparison?: {
      before: number
      after: number
      favorite: boolean
    } | null
  }[]
  ownedGear?: readonly { name: string; stat: string; owner: string | null }[]
}) {
  const description = entry.weapon
    ? [
        entry.desc,
        `固定のワザ（未強化）：${entry.weapon.skills
          .filter((skill) => !skill.random)
          .map(
            (skill) =>
              `${skill.name}（${skill.uses === null ? "回数制限なし" : `${skill.uses}回`}）${skill.desc ? `：${skill.desc}` : ""}`
          )
          .join("\n")}`,
        "追加のワザ・レア度・攻撃力の上振れは、鑑定で決まります。",
      ]
        .filter(Boolean)
        .join("\n")
    : gearDesc(entry)
  return [
    description,
    ...(entry.ownedGear ?? []).map(
      (gear) =>
        `手持ち：${gear.name}（${gear.stat}・${gear.owner ?? "未装備"}）`
    ),
    entry.equipMembers
      ? entry.equipMembers.length
        ? `装備できる仲間：${entry.equipMembers.map((member) => member.name).join("・")}`
        : "今の編成に装備できる仲間はいません。"
      : "",
    ...(entry.equipMembers ?? []).flatMap((member) => {
      const shortage = member.short ? shortText(member.short) : ""
      return shortage ? [`${member.name}：${shortage}`] : []
    }),
    ...(entry.equipMembers?.some((member) => member.attackComparison)
      ? [
          "N・未強化の攻撃力の目安：",
          ...entry.equipMembers.flatMap((member) =>
            member.attackComparison
              ? [
                  `${member.name}：${member.attackComparison.before} → ${member.attackComparison.after}（${member.attackComparison.favorite ? "得意" : "得意ではない"}）`,
                ]
              : []
          ),
        ]
      : []),
    ...(entry.equipMembers?.some((member) => member.armorComparison)
      ? ["未強化・消耗なしで着替えた目安："]
      : []),
    ...(entry.equipMembers ?? []).flatMap((member) => [
      ...(member.currentArmor !== undefined
        ? [
            `${member.name}の現在の防具：${
              member.currentArmor
                ? `${member.currentArmor.name}（${member.currentArmor.stat}）`
                : "防具なし"
            }`,
          ]
        : []),
      ...(member.armorComparison
        ? [armorComparisonText(member.armorComparison, member.name)]
        : []),
    ]),
  ]
    .filter(Boolean)
    .join("\n")
}
