import type { ContentVerification } from "@/lib/wiz/content/content-verification/context"

export function verifySkills({ catalog, need }: ContentVerification) {
  const data = catalog.data

  for (const skill of data.skills) {
    need(
      skill.kind !== "hit" || skill.reach,
      `ワザ ${skill.id} に届き方（reach: melee / ranged）がない`
    )
    need(
      skill.repair === undefined || skill.kind === "heal",
      `防具を直すワザ ${skill.id} は kind を heal にする`
    )
    need(
      skill.sacrifice === undefined || skill.kind === "hit",
      `自分を削るワザ ${skill.id} は kind を hit にする`
    )
    need(
      (skill.drain === undefined && skill.bonusAgainst === undefined) ||
        skill.kind === "hit",
      `吸収・追撃のワザ ${skill.id} は kind を hit にする`
    )
  }
  const brawl = catalog.skill(data.brawl)
  need(brawl, `殴るワザ ${data.brawl} がない`)
  if (brawl) {
    need(
      brawl.kind === "hit" && brawl.reach === "melee",
      `殴るワザ ${brawl.id} は近接の hit にする`
    )
    need(brawl.uses === undefined, `殴るワザ ${brawl.id} に使用回数は付けない`)
  }
}
