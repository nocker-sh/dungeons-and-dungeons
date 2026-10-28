import { describe, expect, it } from "vite-plus/test"
import quests from "@/content/data/quests.json"
import { placeName } from "@/content/looks/place-name"
import { sceneOf } from "@/content/looks/scene-of"

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
      expect(sceneOf(place)).toMatch(/^\/tmp\/scenes\//)
      expect(sceneOf(place, true)).toMatch(/^\/tmp\/scenes\//)
      expect(sceneOf(place, true)).not.toBe(sceneOf(place))
    }
  })
})
