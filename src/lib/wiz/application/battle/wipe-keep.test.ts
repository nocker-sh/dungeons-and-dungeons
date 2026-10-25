import { describe, expect, it } from "vite-plus/test"
import {
  aContent,
  aState,
  createTestGame,
  fightToEnd,
  goodBySlug,
  realContent,
} from "@/lib/wiz/testing"
import { Bag } from "@/lib/wiz/rules"

/** 全滅しても、拾ったガラクタだけは割合ぶん持ち帰れる（balance.wipe.keepJunk・仮）。 */
describe("全滅しても持ち帰れるガラクタ", () => {
  it("[feature:W005] ガラクタと光るガラクタは半分（切り上げ）残り、ほかの拾い物は失う", () => {
    const junk = goodBySlug("junk").id
    const rare = goodBySlug("rare-junk").id
    const crystal = goodBySlug("crystal").id
    const goods = [
      { good: junk, count: 3 },
      { good: rare, count: 1 },
      { good: crystal, count: 2 },
    ]
    const content = aContent().withFoe("kamokutsu", { atk: 9999 }).build()
    const base = aState(content)
      .withMembers({ hp: 1 })
      .inBattle({
        foes: ["kamokutsu"],
        order: ["foe-1", "hero", "alda", "mort"],
      })
      .build()
    if (base.phase.type !== "battle") throw new Error("戦闘で始まる")
    // この探索で拾った物（袋にも入っている）
    const state = {
      ...base,
      bag: Bag.add(base.bag, goods),
      phase: {
        ...base.phase,
        expedition: { ...base.phase.expedition, loot: { gold: 0, goods } },
      },
    }
    const game = createTestGame({ content, random: 0, state })
    fightToEnd(game)
    expect(game.state.phase.type).toBe("town")
    const ratio = realContent().balance.wipe!.keepJunk
    expect(Bag.count(game.state.bag, junk)).toBe(
      Bag.count(base.bag, junk) + Math.ceil(3 * ratio)
    )
    expect(Bag.count(game.state.bag, rare)).toBe(
      Bag.count(base.bag, rare) + Math.ceil(1 * ratio)
    )
    expect(Bag.count(game.state.bag, crystal)).toBe(
      Bag.count(base.bag, crystal)
    )
    expect(game.state.wipe?.kept).toEqual([
      { good: junk, count: Math.ceil(3 * ratio) },
      { good: rare, count: Math.ceil(1 * ratio) },
    ])
    expect(game.state.wipe?.goods).toContainEqual({ good: crystal, count: 2 })
    const result = game.queries.result(game.state)
    expect(result?.kept.map((entry) => entry.count)).toEqual([
      Math.ceil(3 * ratio),
      Math.ceil(1 * ratio),
    ])
  })
})
