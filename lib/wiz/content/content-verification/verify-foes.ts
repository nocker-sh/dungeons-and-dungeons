import type { ContentVerification } from "@/lib/wiz/content/content-verification/context"

export function verifyFoes({ catalog, need }: ContentVerification) {
  const data = catalog.data

  for (const foe of data.foes) {
    for (const skill of Object.keys(foe.skillNames ?? {}))
      need(
        catalog.skill(skill),
        `${foe.id} のワザ名が存在しないワザを指している: ${skill}`
      )
    for (const drop of foe.drops)
      need(catalog.good(drop.good), `${foe.id} の落とし物 ${drop.good} がない`)
    for (const skill of foe.skills ?? [])
      need(catalog.skill(skill), `${foe.id} のワザ ${skill} がない`)
  }
}
