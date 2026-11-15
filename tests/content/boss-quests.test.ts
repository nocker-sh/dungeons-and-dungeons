import { expect, it } from "vite-plus/test"
import { gameContent } from "@/content/game-content"

it("層のボスの討伐依頼は1層に1件・1体だけ（踏破後の再戦は別枠）", () => {
  for (const layer of gameContent.layers) {
    const hunts = gameContent.quests.filter(
      (quest) =>
        quest.foe === layer.boss && !quest.encounter && !quest.requiresCleared
    )
    expect(hunts.map((quest) => quest.count)).toEqual([1])
  }
})
