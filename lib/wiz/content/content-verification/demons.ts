import type { ContentVerification } from "./context"

export function verifyDemons({ catalog, need }: ContentVerification) {
  const data = catalog.data

  for (const demon of data.demons)
    for (const skill of demon.skills) {
      need(catalog.skill(skill), `${demon.id} のワザ ${skill} がない`)
      need(
        catalog.skill(skill)?.uses,
        `${demon.id} のワザ ${skill} に使用回数（uses）がない`
      )
      // 合体した主人公が使えるように、流派付きのワザは悪魔の流派とそろえる
      const school = catalog.skill(skill)?.school
      need(
        !school || school === demon.school,
        `${demon.id} のワザ ${skill} の流派が悪魔の流派と違う`
      )
    }
  for (const demon of data.demons) {
    if (!demon.contract) continue
    need(
      !demon.contract.paper ||
        catalog.good(demon.contract.paper)?.kind === "material",
      `悪魔 ${demon.id} の契約書が不明`
    )
    const encounter = data.conversations?.find(
      (entry) => entry.id === demon.contract!.encounter
    )
    need(
      encounter &&
        encounter.trigger === "talk" &&
        encounter.participants[0] === demon.id &&
        encounter.once,
      `${demon.id} の契約には一度限りの出会い会話が必要`
    )
    const materials = new Set<string>()
    for (const material of demon.contract.materials) {
      need(
        catalog.good(material.good)?.kind === "material",
        `${demon.id} の契約素材が不明`
      )
      need(!materials.has(material.good), `${demon.id} の契約素材が重複`)
      materials.add(material.good)
    }
  }
}
