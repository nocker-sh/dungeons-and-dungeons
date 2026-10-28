import { describe, expect, it } from "vite-plus/test"
import { WizQuestPresentationJa } from "@/lib/wiz/core/presets/quest-presentation-ja"

describe("WizQuestPresentationJa", () => {
  it("完了eventを日本語へ変換する", () => {
    const presentation = new WizQuestPresentationJa({
      resolvers: {
        quest: (questId) => (questId === "slime_hunt" ? "スライム退治" : undefined),
      },
    })

    const text = presentation.formatMessage({
      type: "quest_completed",
      questId: "slime_hunt",
      reward: {
        gold: 50,
        exp: 30,
        affinityBonus: 5,
      },
    })

    expect(text).toBe("「スライム退治」依頼完了! 50G, 30EXP獲得!")
  })

  it("進捗不足の数値をpresentationで組み立てる", () => {
    const presentation = new WizQuestPresentationJa()

    const text = presentation.formatMessage({
      type: "quest_completion_rejected",
      rejection: {
        type: "objective_incomplete",
        questId: "slime_hunt",
        objectiveType: "defeat",
        targetId: "slime",
        current: 2,
        required: 3,
      },
    })

    expect(text).toBe("まだ条件を満たしていない... (2/3)")
    expect(Object.isFrozen(presentation)).toBe(true)
  })
})
