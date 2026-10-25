import { describe, expect, it } from "vitest"
import layers from "@/lib/content/data/layers.json"
import quests from "@/lib/content/data/quests.json"
import { battleSceneOf, layerLook, sceneOf } from "@/lib/content/looks"

/** 戦う場所：ダンジョンの各層（中ボス・ボスの固定戦闘を含む）と、単発依頼の場所。 */
const battlePlaces = [
  ...layers.map((layer) => layer.id),
  ...new Set(
    quests.flatMap((quest) =>
      "encounter" in quest && quest.encounter ? [quest.encounter.place] : []
    )
  ),
]

describe("戦闘の背景", () => {
  it("すべての戦う場所に、探索・場所の背景とは別の縦横の戦闘用の絵がある", () => {
    expect(battlePlaces).toHaveLength(11)
    for (const place of battlePlaces) {
      const tall = battleSceneOf(place)
      const wide = battleSceneOf(place, true)
      expect(tall).toMatch(/^\/art\/scenes\/battle-.+\.webp$/)
      expect(wide).toMatch(/^\/art\/scenes\/battle-.+-wide(-v\d+)?\.webp$/)
      expect(wide).not.toBe(tall)
      expect(tall).not.toBe(sceneOf(place))
      expect(tall).not.toBe(layerLook(place).art)
    }
  })

  it("戦闘用の絵がない場所は、その場所の背景に戻す", () => {
    expect(battleSceneOf("reception")).toBe(sceneOf("reception"))
    expect(battleSceneOf("reception", true)).toBe(sceneOf("reception", true))
    expect(battleSceneOf("存在しない場所")).toBeNull()
  })
})
