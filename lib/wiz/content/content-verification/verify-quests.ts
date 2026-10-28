import type { ContentVerification } from "@/lib/wiz/content/content-verification/context"

export function verifyQuests({ catalog, need }: ContentVerification) {
  const data = catalog.data

  for (const quest of data.quests) {
    for (const foe of quest.encounter?.foes ?? [])
      need(catalog.foe(foe), `依頼 ${quest.id} の戦闘の敵 ${foe} がない`)
    if (quest.encounter) {
      need(
        quest.encounter.reached < data.layers.length,
        `依頼 ${quest.id} の解放層がない`
      )
      need(
        quest.encounter.foes.includes(quest.foe),
        `依頼 ${quest.id} の対象が戦闘にいない`
      )
    }
    need(catalog.foe(quest.foe), `依頼 ${quest.id} の敵 ${quest.foe} がない`)
    for (const entry of quest.reward.goods)
      need(
        catalog.good(entry.good),
        `依頼 ${quest.id} の報酬 ${entry.good} がない`
      )
  }
}
