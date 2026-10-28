import { describe, expect, it } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { realContent } from "@/lib/wiz/testing/real-content"
import { SupplyRules } from "./supply-rules"

const catalog = new GameDefinition(realContent()).catalog
const potion = contentId("potion")
const ether = contentId("ether")
const antidote = contentId("antidote")

describe("旧保存の持ち出し", () => {
  it("同じ品が別の束でも先頭8個の順序を保ち、品ごとに一つの設定へまとめる", () => {
    const state = aState()
      .withBag([
        { good: potion, count: 2 },
        { good: ether, count: 3 },
        { good: potion, count: 4 },
        { good: antidote, count: 2 },
      ])
      .build()
    const before = structuredClone(state)
    expect(SupplyRules.packed(state, catalog)).toEqual([
      { good: potion, count: 5 },
      { good: ether, count: 3 },
    ])
    expect(state).toEqual(before)
  })

  it("明示した設定では袋の全束を合計し、売却後の在庫までに抑える", () => {
    const state = aState()
      .withBag([
        { good: potion, count: 2 },
        { good: ether, count: 3 },
        { good: potion, count: 1 },
      ])
      .build()
    expect(
      SupplyRules.packed(
        { ...state, provisions: [{ good: potion, count: 5 }] },
        catalog
      )
    ).toEqual([{ good: potion, count: 3 }])
    expect(SupplyRules.packed({ ...state, provisions: [] }, catalog)).toEqual(
      []
    )
  })
})
