import { describe, expect, it } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { aState } from "@/lib/wiz/testing/state-builder"
import { realContent } from "@/lib/wiz/testing/real-content"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { contentId } from "@/lib/wiz/testing/content-id"
import { skillBySlug } from "@/lib/wiz/testing/skill-by-slug"

const content = realContent()
const definition = new GameDefinition(content)
const alda = contentId("alda")
const ether = contentId("ether")
const whirl = skillBySlug("whirl")
// アルダのいまの武器に付かないワザ（持ち替える前の武器のワザ）
const charge = skillBySlug("charge")
const etherUses = (() => {
  const effect = definition.catalog.good(ether)?.effect
  return effect?.type === "refill" ? effect.uses : 0
})()

/** 持ち替え前のワザの使用記録と、最大を超えた使用記録だけが残っている状態。 */
const staleUses = [
  { skill: charge.id, count: 3 },
  { skill: whirl.id, count: whirl.uses! + etherUses + 1 },
]
const countOf = (bag: readonly { good: string; count: number }[]) =>
  bag.find((entry) => entry.good === ether)?.count ?? 0

describe("気力の水は、いま使えるワザの残りが増えるときだけ使える", () => {
  it("[feature:W021] 武器を持ち替えたあとの古い使用記録には使えず、減らない", () => {
    const game = definition.create(
      testEnvironment(),
      aState(definition.catalog)
        .withItem("ether", 1)
        .withUses("alda", staleUses)
        .build()
    )
    const forecast = game.queries
      .items(game.state)
      .find((item) => item.id === ether)!
    expect(
      forecast.refill!.members.find((member) => member.id === alda)?.restored
    ).toBe(0)
    const before = game.save()
    expect(game.send({ type: "use", good: ether, member: alda })).toMatchObject(
      { code: "NO_EFFECT" }
    )
    expect(game.send({ type: "use", good: ether })).toMatchObject({
      code: "NO_EFFECT",
    })
    expect(game.save()).toEqual(before)
    expect(countOf(game.state.bag)).toBe(1)
  })

  it("[feature:W021] 戦闘でも古い使用記録には使えず、選べない", () => {
    const game = definition.create(
      testEnvironment(),
      aState(definition.catalog)
        .withBag([{ good: ether, count: 1 }])
        .withUses("alda", staleUses)
        .inBattle({ order: ["mayu", "foe-1", "alda", "mort"] })
        .build()
    )
    const before = game.save()
    const item = game.queries
      .commands(game.state, contentId("mayu"))!
      .items.find((entry) => entry.id === ether)
    expect(item?.targets ?? []).not.toContain(alda)
    expect(
      game.send({ type: "act", command: "item", good: ether, target: alda })
    ).toMatchObject({ code: "NO_EFFECT" })
    expect(game.save()).toEqual(before)
  })

  it("[feature:W021] 使えるワザの残りが増える分だけを戻したと報告する", () => {
    const game = definition.create(
      testEnvironment(),
      aState(definition.catalog)
        .withItem("ether", 1)
        .withUses("alda", [
          { skill: charge.id, count: 3 },
          { skill: whirl.id, count: 1 },
        ])
        .build()
    )
    const events = eventsOrThrow(
      game.send({ type: "use", good: ether, member: alda })
    )
    expect(events[0]).toMatchObject({ results: [{ refill: 1 }] })
    expect(countOf(game.state.bag)).toBe(0)
    expect(
      game.state.members.find((member) => member.id === alda)!.used
    ).toEqual([{ skill: charge.id, count: 3 }])
  })
})
