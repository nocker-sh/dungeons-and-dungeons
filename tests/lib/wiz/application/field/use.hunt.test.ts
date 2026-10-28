import { describe, expect, it } from "vite-plus/test"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { goodBySlug } from "@/lib/wiz/testing/good-by-slug"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { skillBySlug } from "@/lib/wiz/testing/skill-by-slug"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import type { GameAction } from "@/lib/wiz/commands"

/** 回復する道具の量。 */
function amountOf(slug: string) {
  const effect = goodBySlug(slug).effect
  return effect?.type === "heal" ? effect.hp : 0
}

const idOf = (slug: string) => memberBySlug(slug).id

/** 戦闘の外で道具を使う（W021）の不変条件をさがす。 */
describe("道具を使う（戦闘の外）の不変条件", () => {
  const alda = idOf("alda")
  const mort = idOf("mort")
  const jig = idOf("jig")
  const whirl = skillBySlug("whirl")
  const charge = skillBySlug("charge")
  const potionHeal = amountOf("potion")
  // はじめの袋に入っている回復薬の数
  const potions = 3
  const reviveHeal = 20
  // 作品データの気つけ薬・毒消しにはまだ効果がないので、
  // 使う規則を測るためだけに効果を足す
  const content = aContent()
    .withGood("revive", { effect: { type: "revive", hp: reviveHeal } })
    .withGood("antidote", { effect: { type: "cure", kinds: ["poison"] } })
    .build()
  const countOf = (game: ReturnType<typeof createTestGame>, good: string) =>
    game.state.bag.find((entry) => entry.good === contentId(good))?.count ?? 0

  it("[feature:W021] 戦闘中は使えず、袋も状態も変わらない", () => {
    const game = createTestGame({
      content,
      state: aState(content)
        .withItem("potion", potions)
        .withMember("alda", { hp: 10 })
        .inBattle()
        .build(),
    })
    const before = game.state
    expect(
      (
        game.send({
          type: "use",
          good: contentId("potion"),
        }) as GameCommandError
      ).code
    ).toBe("WRONG_PHASE")
    expect(game.state).toBe(before)
    expect(countOf(game, "potion")).toBe(potions)
  })

  it("[feature:W021] 道具でない品物・戦闘だけの道具・持っていない道具は拒否する", () => {
    const game = createTestGame({
      content,
      state: aState(content)
        .withMember("alda", { hp: 10 })
        .withItem("junk", 1)
        .build(),
    })
    for (const [action, code] of [
      [{ type: "use", good: contentId("junk") }, "UNAVAILABLE"],
      [{ type: "use", good: contentId("greatsword") }, "UNAVAILABLE"],
      [{ type: "use", good: contentId("bomb") }, "UNAVAILABLE"],
      [{ type: "use", good: contentId("smoke") }, "UNAVAILABLE"],
      [{ type: "use", good: "no-such-good" }, "UNAVAILABLE"],
      [{ type: "use", good: contentId("elixir") }, "NO_ITEM"],
    ] as const satisfies readonly [GameAction, string][]) {
      const before = game.state
      expect((game.send(action) as GameCommandError).code).toBe(code)
      expect(game.state).toBe(before)
    }
  })

  it("[feature:W021] 対象を省くと、最大HPに対する割合が一番低い仲間に使う", () => {
    // 割合の低い方（アルダ 50%、シオン 60%）が選ばれる
    const aldaMax = memberBySlug("alda").stats.maxHp
    const mortMax = memberBySlug("mort").stats.maxHp
    const game = createTestGame({
      content,
      state: aState(content)
        .withMember("alda", { hp: Math.floor(aldaMax * 0.5) })
        .withMember("mort", { hp: Math.floor(mortMax * 0.6) })
        .build(),
    })
    const events = eventsOrThrow(
      game.send({ type: "use", good: contentId("potion") })
    )
    expect(events[0]).toMatchObject({
      type: "used",
      results: [{ target: { id: alda }, heal: potionHeal }],
    })
  })

  it("[feature:W021] 控えや知らない仲間を指定すると拒否し、道具は減らない", () => {
    const game = createTestGame({
      content,
      state: aState(content).withItem("potion", potions).build(),
    })
    eventsOrThrow(game.send({ type: "recruit", recruit: contentId("r-jig") }))
    for (const member of [jig, "no-such-member"]) {
      const before = game.state
      expect(
        (
          game.send({
            type: "use",
            good: contentId("potion"),
            member,
          }) as GameCommandError
        ).code
      ).toBe("NO_TARGET")
      expect(game.state).toBe(before)
    }
    expect(countOf(game, "potion")).toBe(potions)
  })

  it("[feature:W021] 倒れた仲間に回復薬は使えず、気つけ薬は倒れた仲間にだけ使える", () => {
    const game = createTestGame({
      content,
      state: aState(content)
        .withMember("alda", { hp: 0 })
        .withItem("revive", 2)
        .build(),
    })
    const before = game.state
    expect(
      (
        game.send({
          type: "use",
          good: contentId("potion"),
          member: alda,
        }) as GameCommandError
      ).code
    ).toBe("NO_EFFECT")
    expect(game.state).toBe(before)
    // 生きている仲間を指定すると気つけ薬は使えない
    expect(
      (
        game.send({
          type: "use",
          good: contentId("revive"),
          member: mort,
        }) as GameCommandError
      ).code
    ).toBe("NO_EFFECT")
    const events = eventsOrThrow(
      game.send({ type: "use", good: contentId("revive") })
    )
    expect(events[0]).toMatchObject({
      type: "used",
      results: [{ target: { id: alda }, heal: reviveHeal, revived: true }],
    })
    expect(game.queries.member(game.state, alda)!.hp).toBe(reviveHeal)
    expect(countOf(game, "revive")).toBe(1)
  })

  it("[feature:W021] 倒れた仲間がいなければ気つけ薬は拒否され、道具は減らない", () => {
    const game = createTestGame({
      content,
      state: aState(content).withItem("revive", 1).build(),
    })
    const before = game.state
    expect(
      (
        game.send({
          type: "use",
          good: contentId("revive"),
        }) as GameCommandError
      ).code
    ).toBe("NO_EFFECT")
    expect(game.state).toBe(before)
    expect(countOf(game, "revive")).toBe(1)
  })

  it("[feature:W021] 回復はHPの最大を超えず、倒れた仲間は起きない", () => {
    const game = createTestGame({
      content,
      state: aState(content)
        .withMember("alda", { hp: memberBySlug("alda").stats.maxHp - 5 })
        .withMember("mort", { hp: 0 })
        .withItem("hipotion", 1)
        .build(),
    })
    const events = eventsOrThrow(
      game.send({
        type: "use",
        good: contentId("hipotion"),
        member: alda,
      })
    )
    expect(events[0]).toMatchObject({ results: [{ heal: 5 }] })
    expect(game.queries.member(game.state, alda)!.hp).toBe(
      memberBySlug("alda").stats.maxHp
    )
    expect(game.queries.member(game.state, mort)!.hp).toBe(0)
  })

  it("[feature:W021] 霊薬は出撃メンバー全員を回復し、倒れた仲間と控えには効かない", () => {
    const game = createTestGame({
      content,
      state: aState(content).withItem("elixir", 1).build(),
    })
    eventsOrThrow(game.send({ type: "recruit", recruit: contentId("r-jig") }))
    const wounded = createTestGame({
      content,
      state: {
        ...game.state,
        members: game.state.members.map((member) =>
          member.id === mort ? { ...member, hp: 0 } : { ...member, hp: 5 }
        ),
      },
    })
    const events = eventsOrThrow(
      wounded.send({ type: "use", good: contentId("elixir") })
    )
    const used = events[0]
    if (used.type !== "used") throw new Error("使った出来事が出ない")
    const healed = wounded.state.party.filter((id) => id !== mort)
    expect(used.results.map((result) => result.target.id).toSorted()).toEqual(
      [...healed].toSorted()
    )
    for (const id of healed) {
      const member = wounded.queries.member(wounded.state, id)!
      expect(member.hp).toBe(member.maxHp)
    }
    expect(wounded.queries.member(wounded.state, mort)!.hp).toBe(0)
    expect(wounded.queries.member(wounded.state, jig)!.hp).toBe(5)
  })

  it("[feature:W021] 気力の水はワザの残りを戻し、戻す分がなくても0未満にならない", () => {
    const game = createTestGame({
      content,
      state: aState(content)
        .withItem("ether", 2)
        .withUses("alda", [
          { skill: whirl.id, count: 1 },
          { skill: charge.id, count: 3 },
        ])
        .build(),
    })
    const per = 2
    const before = game.save()
    const forecast = game.queries
      .items(game.state)
      .find((item) => item.id === contentId("ether"))!.refill!
    expect(forecast.perSkill).toBe(per)
    expect(
      forecast.members.find((member) => member.id === alda)?.restored
    ).toBe(3)
    expect(game.save()).toEqual(before)
    const events = eventsOrThrow(
      game.send({ type: "use", good: contentId("ether"), member: alda })
    )
    expect(events[0]).toMatchObject({ results: [{ refill: 1 + per }] })
    expect(
      game.queries
        .items(game.state)
        .find((item) => item.id === contentId("ether"))!
        .refill!.members.find((member) => member.id === alda)?.restored
    ).toBe(1)
    expect(
      game.state.members.find((member) => member.id === alda)!.used
    ).toEqual([{ skill: charge.id, count: 3 - per }])
    eventsOrThrow(
      game.send({ type: "use", good: contentId("ether"), member: alda })
    )
    expect(
      game.state.members.find((member) => member.id === alda)!.used
    ).toEqual([])
  })

  it("[feature:W021] 毒消しは指定した仲間の毒だけ消し、ほかの状態は残す", () => {
    const game = createTestGame({
      content,
      state: aState(content)
        .withItem("antidote", 1)
        .withMember("mort", {
          status: [
            { kind: "poison", turns: 3 },
            { kind: "protect", turns: 1 },
          ],
        })
        .build(),
    })
    const before = game.save()
    const predicted = game.queries
      .items(game.state)
      .find((item) => item.id === contentId("antidote"))!.curing!
    expect(predicted).toHaveLength(1)
    expect(predicted[0]).toMatchObject({
      id: mort,
      kinds: ["poison"],
      names: ["毒"],
    })
    expect(game.save()).toEqual(before)
    const events = eventsOrThrow(
      game.send({
        type: "use",
        good: contentId("antidote"),
        member: mort,
      })
    )
    expect(events[0]).toMatchObject({
      results: [{ target: { id: mort }, cured: ["poison"] }],
    })
    expect(
      game.state.members.find((member) => member.id === mort)!.status
    ).toEqual([{ kind: "protect", turns: 1 }])
  })

  it("[feature:W021] 探索中の板が出ていても道具は使える", () => {
    const game = createTestGame({
      content,
      state: aState(content)
        .withMember("alda", { hp: 10 })
        .inExpedition({ pending: { kind: "trap", damage: 7 } })
        .build(),
    })
    eventsOrThrow(game.send({ type: "use", good: contentId("potion") }))
    expect(game.queries.member(game.state, alda)!.hp).toBe(10 + potionHeal)
    expect(game.queries.expedition(game.state)!.pending).toEqual({
      kind: "trap",
      damage: 7,
    })
  })

  it("[feature:W021] 満タンの仲間には回復薬を使えず、道具も減らない", () => {
    const game = createTestGame({
      content,
      state: aState(content).withItem("potion", potions).build(),
    })
    const before = game.state
    expect(
      (
        game.send({
          type: "use",
          good: contentId("potion"),
        }) as GameCommandError
      ).code
    ).toBe("NO_EFFECT")
    expect(game.state).toBe(before)
    expect(countOf(game, "potion")).toBe(potions)
  })

  it("[feature:W021] 気力の水は、ワザを使った仲間にだけ使える", () => {
    const fresh = createTestGame({
      content,
      state: aState(content).withItem("ether", 1).build(),
    })
    expect(
      (
        fresh.send({
          type: "use",
          good: contentId("ether"),
        }) as GameCommandError
      ).code
    ).toBe("NO_EFFECT")
    expect(countOf(fresh, "ether")).toBe(1)
    const used = createTestGame({
      content,
      state: aState(content)
        .withItem("ether", 1)
        .withMember("alda", { used: [{ skill: whirl.id, count: 2 }] })
        .build(),
    })
    const events = eventsOrThrow(
      used.send({ type: "use", good: contentId("ether") })
    )
    expect(events[0]).toMatchObject({ results: [{ refill: 2 }] })
    expect(countOf(used, "ether")).toBe(0)
  })

  it("[feature:W021] 解毒薬は、その状態の仲間にだけ使える", () => {
    const clean = createTestGame({
      content,
      state: aState(content).withItem("antidote", 1).build(),
    })
    expect(
      (
        clean.send({
          type: "use",
          good: contentId("antidote"),
        }) as GameCommandError
      ).code
    ).toBe("NO_EFFECT")
    expect(countOf(clean, "antidote")).toBe(1)
    const poisoned = createTestGame({
      content,
      state: aState(content)
        .withItem("antidote", 1)
        .withMember("alda", { status: [{ kind: "poison", turns: 3 }] })
        .build(),
    })
    const events = eventsOrThrow(
      poisoned.send({ type: "use", good: contentId("antidote") })
    )
    expect(events[0]).toMatchObject({ results: [{ cured: ["poison"] }] })
    expect(countOf(poisoned, "antidote")).toBe(0)
  })
})
