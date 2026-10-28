import { describe, expect, it } from "vite-plus/test"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { realContent } from "@/lib/wiz/testing/real-content"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import type { GameEvent } from "@/lib/wiz/state/game-event"

const actedOf = (events: readonly GameEvent[]) => {
  const acted = events.find((event) => event.type === "acted")
  if (acted?.type !== "acted") throw new Error("行動の出来事がない")
  return acted
}

/** 敵の攻撃の届き方。近接は前衛へ、遠距離は後衛にも届くが当たりにくい。 */
describe("敵の攻撃と後衛", () => {
  const hit = realContent().balance.backRow.hit
  const mort = contentId("mort")

  /** 敵が先に動く戦闘。front で前衛の2人を倒しておくと、狙えるのは後衛のモートだけになる。 */
  function foeFirst(options: {
    reach: "melee" | "ranged"
    random: number
    frontDown?: boolean
    skill?: boolean
  }) {
    const content = aContent()
      .withSkill("poison-spit", {
        status: { kind: "poison", turns: 3, chance: 1 },
      })
      .withFoe("kamokutsu", {
        atk: 20,
        attack: { name: "投げつけ", reach: options.reach },
        skills: options.skill ? [contentId("poison-spit")] : [],
        skillRate: options.skill ? 1 : 0,
      })
      .build()
    let builder = aState(content)
    if (options.frontDown)
      builder = builder
        .withMember("hero", { hp: 0 })
        .withMember("alda", { hp: 0 })
    const state = builder
      .inBattle({
        foes: ["kamokutsu"],
        order: ["foe-1", "hero", "alda", "mort"],
      })
      .build()
    return createTestGame({ content, state, random: options.random })
  }

  it("近接の攻撃は、乱数が端でも後衛に届かない", () => {
    for (const random of [0, 0.5, 0.999]) {
      const game = foeFirst({ reach: "melee", random })
      const acted = actedOf(eventsOrThrow(game.send({ type: "foe-turn" })))
      expect(acted.results).toHaveLength(1)
      expect(acted.results[0].target.id).not.toBe(mort)
      expect(acted.results[0].missed).toBeUndefined()
    }
  })

  it("前衛が倒れていれば、近接も後衛に届いて必ず当たる", () => {
    const game = foeFirst({ reach: "melee", random: 0.999, frontDown: true })
    const before = game.queries.member(game.state, mort)!.hp
    const acted = actedOf(eventsOrThrow(game.send({ type: "foe-turn" })))
    expect(acted.results[0].target.id).toBe(mort)
    expect(acted.results[0].missed).toBeUndefined()
    expect(game.queries.member(game.state, mort)!.hp).toBeLessThan(before)
  })

  it("遠距離の攻撃は後衛に届き、命中の確率より下の乱数なら当たる", () => {
    const game = foeFirst({
      reach: "ranged",
      random: hit - 0.01,
      frontDown: true,
    })
    const before = game.queries.member(game.state, mort)!.hp
    const acted = actedOf(eventsOrThrow(game.send({ type: "foe-turn" })))
    expect(acted.results[0]).toMatchObject({ target: { id: mort } })
    expect(acted.results[0].missed).toBeUndefined()
    expect(acted.results[0].damage).toBeGreaterThan(0)
    expect(game.queries.member(game.state, mort)!.hp).toBeLessThan(before)
  })

  it("後衛に外れた遠距離の攻撃は、被害も防具の傷みも残さない", () => {
    const game = foeFirst({ reach: "ranged", random: hit, frontDown: true })
    const before = game.state.members.find((member) => member.id === mort)!
    const armor = game.queries.member(game.state, mort)!.armor
    const acted = actedOf(eventsOrThrow(game.send({ type: "foe-turn" })))
    expect(acted.results).toEqual([
      { target: { kind: "member", id: mort }, missed: true },
    ])
    const after = game.state.members.find((member) => member.id === mort)!
    expect(after.hp).toBe(before.hp)
    expect(game.queries.member(game.state, mort)!.armor).toEqual(armor)
    // 外れても手番は次へ回り、保存から同じ状態に戻る
    expect(game.queries.battle(game.state)?.current).not.toEqual({
      kind: "foe",
      id: "foe-1",
    })
    expect(game.restore(game.save())).toBeUndefined()
  })

  it("後衛に外れた遠距離のワザは、状態異常も届かない", () => {
    const missed = foeFirst({
      reach: "ranged",
      random: 0.999,
      frontDown: true,
      skill: true,
    })
    const result = actedOf(eventsOrThrow(missed.send({ type: "foe-turn" })))
      .results[0]
    expect(result).toMatchObject({ target: { id: mort }, missed: true })
    expect(result.status).toBeUndefined()
    expect(missed.queries.member(missed.state, mort)!.status).toEqual([])
    // 当たれば毒が残る（同じワザで、外れたときとの違いを確かめる）
    const landed = foeFirst({
      reach: "ranged",
      random: hit - 0.01,
      frontDown: true,
      skill: true,
    })
    const hitResult = actedOf(eventsOrThrow(landed.send({ type: "foe-turn" })))
      .results[0]
    expect(hitResult).toMatchObject({ target: { id: mort }, status: "poison" })
  })

  it("前衛への遠距離の攻撃は外れない", () => {
    // 乱数0は重みの先頭（主人公）を狙う。命中の判定は後衛だけにかかる
    const game = foeFirst({ reach: "ranged", random: 0 })
    const acted = actedOf(eventsOrThrow(game.send({ type: "foe-turn" })))
    expect(acted.results[0].target.id).toBe(contentId("hero"))
    expect(acted.results[0].missed).toBeUndefined()
    expect(acted.results[0].damage).toBeGreaterThan(0)
  })
})
