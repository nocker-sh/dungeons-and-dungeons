import { describe, expect, it } from "vitest"
import quests from "@/lib/content/data/quests.json"
import { placeName, sceneOf } from "@/lib/content/looks"

describe("単発依頼の戦う場所", () => {
  const places = [
    ...new Set(
      quests.flatMap((quest) =>
        "encounter" in quest && quest.encounter ? [quest.encounter.place] : []
      )
    ),
  ]

  it("すべての場所に名前と縦横の背景がある", () => {
    expect(places.length).toBeGreaterThanOrEqual(6)
    for (const place of places) {
      expect(placeName(place)).not.toBe(place)
      expect(sceneOf(place)).toMatch(/^\/art\/scenes\//)
      expect(sceneOf(place, true)).toMatch(/^\/art\/scenes\//)
      expect(sceneOf(place, true)).not.toBe(sceneOf(place))
    }
  })
})
