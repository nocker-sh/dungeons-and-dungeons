import { describe, expect, it } from "vite-plus/test"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { aState } from "@/lib/wiz/testing/state-builder"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { fightToEnd } from "@/lib/wiz/testing/fight-to-end"
import { goodBySlug } from "@/lib/wiz/testing/good-by-slug"
import { realContent } from "@/lib/wiz/testing/real-content"
import { Bag } from "@/lib/wiz/rules/bag"

/** 全滅しても、拾ったガラクタだけは割合ぶん持ち帰れる（balance.wipe.keepJunk・仮）。 */
describe("全滅しても持ち帰れるガラクタ", () => {
  it.each([0, 1, 2, 3, 4, 7])(
    "同じ戦利品が複数の束でも、所持数%dの精算・結果・保存が一つの束と一致する",
    (held) => {
      const junk = goodBySlug("junk").id
      const rare = goodBySlug("rare-junk").id
      const crystal = goodBySlug("crystal").id
      const goods = [
        { good: junk, count: 4 },
        { good: rare, count: 3 },
        { good: crystal, count: 4 },
      ]
      const content = aContent().withFoe("kamokutsu", { atk: 9999 }).build()
      const base = aState(content)
        .withMembers({ hp: 1 })
        .withBag([
          ...(held ? [{ good: junk, count: held }] : []),
          { good: rare, count: 5 },
          { good: crystal, count: 6 },
        ])
        .inBattle({
          foes: ["kamokutsu"],
          order: ["foe-1", "hero", "alda", "mort"],
        })
        .build()
      if (base.phase.type !== "battle") throw new Error("戦闘で始まる")
      const phase = base.phase
      const finish = (split: boolean) => {
        const game = createTestGame({
          content,
          random: 0,
          state: {
            ...base,
            phase: {
              ...phase,
              expedition: {
                ...phase.expedition,
                loot: {
                  gold: 0,
                  goods: split
                    ? goods.flatMap((entry) =>
                        Array.from({ length: entry.count }, () => ({
                          good: entry.good,
                          count: 1,
                        }))
                      )
                    : goods,
                },
              },
            },
          },
        })
        // 保存境界が受け付ける途中状態から、実際の戦闘で全滅させる。
        expect(game.restore(game.save())).toBeUndefined()
        fightToEnd(game)
        expect(game.state.phase.type).toBe("town")
        const saved = game.save()
        expect(game.restore(saved)).toBeUndefined()
        expect(game.save()).toEqual(saved)
        return { saved, result: game.queries.result(game.state) }
      }
      const grouped = finish(false)
      const split = finish(true)
      const ratio = content.balance.wipe!.keepJunk
      expect(Bag.count(grouped.saved.snapshot.bag, junk)).toBe(
        Math.max(0, held - 4) + Math.ceil(Math.min(held, 4) * ratio)
      )
      expect(Bag.count(grouped.saved.snapshot.bag, rare)).toBe(
        2 + Math.ceil(3 * ratio)
      )
      expect(Bag.count(grouped.saved.snapshot.bag, crystal)).toBe(2)
      expect(split).toEqual(grouped)
    }
  )

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
