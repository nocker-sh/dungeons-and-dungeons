import { describe, expect, it } from "vite-plus/test"
import {
  GameStateBuilder,
  contentId,
  createTestPlay,
  eventsOrThrow,
  goodBySlug,
  memberBySlug,
  startedState,
} from "@/lib/wiz/testing"
import { GameCommandError } from "@/lib/wiz"

describe("道具", () => {
  it("[feature:W021] 探索中に回復薬を使うと一番弱っている仲間が回復し、爆弾は使えない", () => {
    const { definition } = createTestPlay()
    const mort = memberBySlug("mort").id
    const potion = goodBySlug("potion")
    const heal = potion.effect?.type === "heal" ? potion.effect.hp : 0
    const base = GameStateBuilder.from(
      startedState(definition),
      definition.catalog
    )
      .withItem("potion", 3)
      .withItem("bomb", 1)
      .build()
    const game = definition.create(undefined, {
      ...base,
      members: base.members.map((member) =>
        member.id === mort ? { ...member, hp: 5 } : member
      ),
      phase: {
        type: "expedition",
        expedition: {
          layer: contentId("layer0"),
          at: "s",
          visited: ["s"],
          events: [],
          pending: null,
          loot: { gold: 0, goods: [] },
          cleared: false,
        },
      },
    })
    const events = eventsOrThrow(
      game.send({ type: "use", good: contentId("potion") })
    )
    expect(events[0]).toMatchObject({
      type: "used",
      results: [{ target: { id: mort }, heal }],
    })
    expect(
      game.queries.items(game.state).find((entry) => entry.id === potion.id)
        ?.count
    ).toBe(2)
    expect(
      (game.send({ type: "use", good: contentId("bomb") }) as GameCommandError)
        .code
    ).toBe("UNAVAILABLE")
    expect(
      game.queries
        .items(game.state)
        .find((entry) => entry.id === contentId("bomb"))?.field
    ).toBe(false)
  })
  it("回復予告は負傷・満タン・戦闘不能を区別し、実際の回復量と一致する", () => {
    const { definition } = createTestPlay()
    const base = GameStateBuilder.from(
      startedState(definition),
      definition.catalog
    )
      .withItem("potion", 3)
      .build()
    const reference = definition.create(undefined, base)
    // 出撃は3人なので、満タンは回復した後の nearlyFull で確かめる
    const [hurt, nearlyFull, dead] = base.party
    const state = {
      ...base,
      members: base.members.map((member) => {
        const maxHp = reference.queries.member(base, member.id)!.maxHp
        return {
          ...member,
          hp:
            member.id === hurt
              ? 1
              : member.id === nearlyFull
                ? maxHp - 5
                : member.id === dead
                  ? 0
                  : maxHp,
        }
      }),
    }
    const game = definition.create(undefined, state)
    const before = game.save()
    const forecast = game.queries
      .items(game.state)
      .find((item) => item.id === contentId("potion"))!.healing!
    expect(game.save()).toEqual(before)
    expect(forecast.some((member) => member.id === dead)).toBe(false)
    expect(forecast.find((member) => member.id === nearlyFull)?.restored).toBe(
      5
    )
    for (const id of [hurt, nearlyFull]) {
      const predicted = forecast.find((member) => member.id === id)!
      const events = eventsOrThrow(
        game.send({ type: "use", good: contentId("potion"), member: id })
      )
      expect(events[0]).toMatchObject({
        type: "used",
        results: [{ heal: predicted.restored }],
      })
      expect(game.queries.member(game.state, id)?.hp).toBe(predicted.after)
    }
    const full = nearlyFull
    expect(
      game.queries
        .items(game.state)
        .find((item) => item.id === contentId("potion"))!
        .healing!.find((member) => member.id === full)?.restored
    ).toBe(0)
    const after = game.save()
    expect(
      (
        game.send({
          type: "use",
          good: contentId("potion"),
          member: dead,
        }) as GameCommandError
      ).code
    ).toBe("NO_EFFECT")
    expect(game.save()).toEqual(after)
  })
  it("蘇生の香は倒れた仲間だけを予告し、最大HPで止まる", () => {
    const { definition } = createTestPlay()
    const base = GameStateBuilder.from(
      startedState(definition),
      definition.catalog
    )
      .withItem("revival-incense", 2)
      .build()
    const dead = base.party[0]
    const game = definition.create(undefined, {
      ...base,
      members: base.members.map((member) =>
        member.id === dead ? { ...member, hp: 0 } : member
      ),
    })
    const saved = game.save()
    const forecast = game.queries
      .items(game.state)
      .find((item) => item.id === contentId("revival-incense"))!.healing!
    expect(game.save()).toEqual(saved)
    expect(forecast).toHaveLength(1)
    expect(forecast[0].id).toBe(dead)
    expect(forecast[0].hp).toBe(0)
    expect(forecast[0].after).toBe(Math.min(300, forecast[0].maxHp))
    const events = eventsOrThrow(
      game.send({
        type: "use",
        good: contentId("revival-incense"),
        member: dead,
      })
    )
    expect(events[0]).toMatchObject({
      type: "used",
      results: [{ revived: true, heal: forecast[0].restored }],
    })
    expect(game.queries.member(game.state, dead)?.hp).toBe(forecast[0].after)
    const item = game.queries
      .items(game.state)
      .find((item) => item.id === contentId("revival-incense"))!
    expect(item.count).toBe(1)
    expect(item.healing).toEqual([])
    expect(item.usable).toBe(false)
  })
})
