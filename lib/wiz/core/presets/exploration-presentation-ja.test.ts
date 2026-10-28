import { describe, expect, it } from "vite-plus/test"
import { WizExplorationPresentationJa } from "@/lib/wiz/core/presets/exploration-presentation-ja"

describe("WizExplorationPresentationJa", () => {
  it("semantic item IDsを表示名へ解決する", () => {
    const presentation = new WizExplorationPresentationJa({
      resolvers: {
        item: (itemId) => ({ herb: "薬草", seed: "種" })[itemId],
      },
    })

    const text = presentation.formatMessage({
      type: "items_gathered",
      areaId: "forest",
      itemIds: ["herb", "seed"],
    })

    expect(text).toBe("薬草を採集した! 種もおまけで見つけた!")
  })

  it("テンプレートを型安全に差し替えられる", () => {
    const presentation = new WizExplorationPresentationJa({
      templates: {
        alreadyRested: () => "REST_NOT_REQUIRED",
      },
    })

    expect(
      presentation.formatMessage({
        type: "action_rejected",
        action: "rest",
        areaId: "forest",
        reason: "already_rested",
      }),
    ).toBe("REST_NOT_REQUIRED")
    expect(Object.isFrozen(presentation)).toBe(true)
  })
})
