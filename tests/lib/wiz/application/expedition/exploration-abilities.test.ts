import { describe, expect, it } from "vite-plus/test"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { aContent } from "@/lib/wiz/testing/content-builder"
import { aState } from "@/lib/wiz/testing/state-builder"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { realContent } from "@/lib/wiz/testing/real-content"
import { contentId } from "@/lib/wiz/testing/content-id"
import { ExplorationRules } from "@/lib/wiz/rules/exploration-rules"
import { GameCatalog } from "@/lib/wiz/content/game-catalog"

/** 察知（scout）はマユの探索能力。最初の仲間にいないので、モートと入れ替えて出撃させる。 */
const withScout = () => aState().withJoined("mayu", { replacing: "mort" })

describe("編成で変わる探索能力", () => {
  it("未知のボス地点の察知を保存・再開し、ボスと戦える", () => {
    const boss = realContent().layers[0].stations.find((entry) => entry.boss)!
    const content = aContent()
      .withStation("layer0", boss.id, { mystery: true, event: undefined })
      .build()
    const layer = new GameCatalog(content).data.layers[0]
    const source = layer.stations.find((entry) => entry.next.includes(boss.id))!
    const game = createTestGame({
      content,
      state: aState(content)
        .withJoined("mayu", { replacing: "mort" })
        .inExpedition({ at: source.id })
        .build(),
    })
    expect(
      eventsOrThrow(game.send({ type: "survey", to: boss.id }))
    ).toContainEqual({ type: "surveyed", station: boss.id, kind: "boss" })
    const saved = game.save()
    expect(game.restore(saved)).toBeUndefined()
    expect(game.save()).toEqual(saved)
    if (saved.snapshot.phase.type !== "expedition")
      throw new Error("探索ではない")
    const invalid = {
      ...saved,
      snapshot: {
        ...saved.snapshot,
        phase: {
          ...saved.snapshot.phase,
          expedition: {
            ...saved.snapshot.phase.expedition,
            surveyed: [{ station: boss.id, kind: "trap" }],
          },
        },
      },
    }
    expect(game.restore(invalid)).toBeInstanceOf(GameCommandError)
    expect(game.save()).toEqual(saved)
    expect(
      eventsOrThrow(game.send({ type: "advance", to: boss.id }))
    ).toContainEqual({ type: "encounter", foes: [layer.boss], boss: true })
    expect(game.restore(game.save())).toBeUndefined()
  })

  it("ボス指定と固定イベントが併記されても、ボス以外の察知記録を拒否する", () => {
    const boss = realContent().layers[0].stations.find((entry) => entry.boss)!
    const content = aContent()
      .withStation("layer0", boss.id, { mystery: true, event: "trap" })
      .build()
    const game = createTestGame({
      content,
      state: aState(content).inExpedition().build(),
    })
    const saved = game.save()
    if (saved.snapshot.phase.type !== "expedition")
      throw new Error("探索ではない")
    const invalid = {
      ...saved,
      snapshot: {
        ...saved.snapshot,
        phase: {
          ...saved.snapshot.phase,
          expedition: {
            ...saved.snapshot.phase.expedition,
            surveyed: [{ station: boss.id, kind: "trap" }],
          },
        },
      },
    }
    expect(game.restore(invalid)).toBeInstanceOf(GameCommandError)
    expect(game.save()).toEqual(saved)
  })

  it.each([
    { kind: "battle", roll: 0.1 },
    { kind: "treasure", roll: 0.6 },
    { kind: "trap", roll: 0.9 },
  ] as const)(
    "層の抽選設定で察知した $kind を保存・再開しても固定する",
    ({ kind, roll }) => {
      const content = aContent()
        .withLayer("layer0", { weights: { battle: 3, treasure: 2, trap: 1 } })
        .withStation("layer0", "m3", {
          weights: undefined,
          discovery: undefined,
        })
        .build()
      let random = roll as number
      const game = createTestGame({
        content,
        state: aState(content)
          .withJoined("mayu", { replacing: "mort" })
          .inExpedition({ at: "n2", visited: ["s", "n2"] })
          .build(),
        random: () => random,
      })
      expect(
        eventsOrThrow(game.send({ type: "survey", to: "m3" }))
      ).toContainEqual({ type: "surveyed", station: "m3", kind })
      expect(game.queries.problems(game.state)).toEqual([])
      const saved = game.save()
      expect(game.restore(saved)).toBeUndefined()
      expect(game.save()).toEqual(saved)
      random = roll === 0.1 ? 0.9 : 0.1
      expect(
        eventsOrThrow(game.send({ type: "advance", to: "m3" }))
      ).toContainEqual({ type: "arrived", station: "m3", kind })
    }
  )

  it.each(["weighted", "fixed"] as const)(
    "地点の設定が%sなら、層の候補だけでは察知記録を許可しない",
    (mode) => {
      const content = aContent()
        .withLayer("layer0", { weights: { battle: 1, treasure: 1, trap: 1 } })
        .withStation("layer0", "m3", {
          event: mode === "fixed" ? "trap" : undefined,
          weights:
            mode === "weighted"
              ? { battle: 0, treasure: 0, trap: 1, discovery: 0 }
              : undefined,
          discovery: undefined,
        })
        .build()
      const state = aState(content).inExpedition({ at: "n2" }).build()
      const game = createTestGame({ content, state })
      const saved = game.save()
      if (saved.snapshot.phase.type !== "expedition")
        throw new Error("探索ではない")
      const invalid = {
        ...saved,
        snapshot: {
          ...saved.snapshot,
          phase: {
            ...saved.snapshot.phase,
            expedition: {
              ...saved.snapshot.phase.expedition,
              surveyed: [{ station: "m3", kind: "treasure" }],
            },
          },
        },
      }
      expect(game.restore(invalid)).toBeInstanceOf(Error)
      expect(game.save()).toEqual(saved)
    }
  )

  it("[feature:W038] 察知で結果を固定し、見るだけ・再察知では乱数や回数を消費しない", () => {
    let roll = 0.7
    let calls = 0
    const game = createTestGame({
      state: withScout()
        .inExpedition({ at: "n2", visited: ["s", "n2"] })
        .build(),
      random: () => {
        calls++
        return roll
      },
    })
    const before = calls
    game.queries.route(game.state)
    expect(calls).toBe(before)
    eventsOrThrow(game.send({ type: "survey", to: "m3" }))
    expect(calls).toBe(before + 1)
    expect(
      game.queries.route(game.state)!.paths.find((path) => path.id === "m3")!
        .label
    ).toContain("罠")
    expect(game.queries.route(game.state)!.surveyLeft).toBe(0)
    const surveyed = game.state
    expect(game.send({ type: "survey", to: "m3" })).toBeInstanceOf(
      GameCommandError
    )
    expect(game.state).toBe(surveyed)
    expect(calls).toBe(before + 1)
    expect(game.restore(game.save())).toBeUndefined()
    roll = 0.1
    eventsOrThrow(game.send({ type: "advance", to: "m3" }))
    expect(game.queries.expedition(game.state)!.pending?.kind).toBe("trap")
  })

  it("察知は生存中の同行者が必要で、控え・倒れた仲間は効果を持たない", () => {
    const game = createTestGame({
      state: withScout()
        .withMember("mayu", { hp: 0 })
        .inExpedition({ at: "n2" })
        .build(),
    })
    const before = game.state
    expect(game.send({ type: "survey", to: "m3" })).toBeInstanceOf(
      GameCommandError
    )
    expect(game.state).toBe(before)
    const rules = new ExplorationRules(new GameCatalog(realContent()))
    expect(
      rules.has(
        {
          ...withScout().build(),
          party: [contentId("hero"), contentId("alda"), contentId("mort")],
        },
        "scout"
      )
    ).toBe(false)
  })

  it("旧版の2回察知した保存も読めるが、追加の察知はできない", () => {
    const game = createTestGame({
      state: withScout()
        .inExpedition({
          at: "n14",
          surveyed: [
            { station: "n3", kind: "discovery" },
            { station: "m3", kind: "trap" },
          ],
        })
        .build(),
    })
    const before = game.state
    expect(game.send({ type: "survey", to: "m15" })).toBeInstanceOf(
      GameCommandError
    )
    expect(game.state).toBe(before)
    const save = game.save()
    expect(game.restore(save)).toBeUndefined()
    const restored = game.state
    const invalid = {
      ...save,
      snapshot: {
        ...save.snapshot,
        phase: {
          type: "expedition",
          expedition: {
            ...game.queries.expedition(game.state)!,
            surveyed: [{ station: "m3", kind: "boss" }],
          },
        },
      },
    }
    expect(game.restore(invalid)).toBeInstanceOf(Error)
    expect(game.state).toBe(restored)
    eventsOrThrow(game.send({ type: "retreat" }))
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    expect(game.queries.route(game.state)!.surveyLeft).toBe(1)
  })

  it("未知の道のどちらで使うか選び、既知の店には使わない", () => {
    const game = createTestGame({
      state: withScout().inExpedition({ at: "n2" }).build(),
    })
    const before = game.state
    expect(
      game.queries.route(game.state)!.paths.find((path) => path.id === "n3")!
        .canSurvey
    ).toBe(false)
    expect(game.send({ type: "survey", to: "n3" })).toBeInstanceOf(
      GameCommandError
    )
    expect(game.state).toBe(before)
    eventsOrThrow(game.send({ type: "survey", to: "m3" }))
    const save = game.save()
    if (save.snapshot.phase.type !== "expedition") throw new Error("fixture")
    expect(
      game.restore({
        ...save,
        snapshot: {
          ...save.snapshot,
          phase: {
            ...save.snapshot.phase,
            expedition: { ...save.snapshot.phase.expedition, at: "n14" },
          },
        },
      })
    ).toBeUndefined()
    const used = game.state
    expect(game.send({ type: "survey", to: "m15" })).toBeInstanceOf(
      GameCommandError
    )
    expect(game.state).toBe(used)
    const fresh = createTestGame({
      state: withScout().inExpedition({ at: "n14" }).build(),
    })
    eventsOrThrow(fresh.send({ type: "survey", to: "m15" }))
    expect(fresh.queries.route(fresh.state)!.surveyLeft).toBe(0)
  })

  it("同じ能力を重ねても加算せず、交渉・罠対策・野営・目利きが働く", () => {
    const catalog = new GameCatalog(realContent())
    const rules = new ExplorationRules(catalog)
    const state = aState().build()
    expect(rules.trap(state, 20)).toBe(15)
    expect(rules.refill(state, 2)).toBe(3)
    expect(rules.refill(state, 0)).toBe(0)
    const alma = catalog.data.recruits.find(
      (entry) => entry.member.id === contentId("alma")
    )!.member
    const gou = catalog.data.recruits.find(
      (entry) => entry.member.id === contentId("gou")
    )!.member
    const added = {
      ...state,
      members: [
        ...state.members,
        { ...state.members[0], id: alma.id },
        { ...state.members[0], id: gou.id },
      ],
      party: [contentId("hero"), alma.id, gou.id],
    }
    expect(rules.cost(added, 35)).toBe(30)
    expect(rules.gold(added, 100)).toBe(110)
    expect(
      rules.refill(
        {
          ...added,
          party: [contentId("hero"), contentId("mort"), contentId("mort")],
        },
        2
      )
    ).toBe(3)
  })

  it("全ての現役の仲間に戦い方と探索の採用理由がある", () => {
    const recruits = realContent().recruits.filter((entry) => !entry.retired)
    // ミミカを N の仲間として募集に戻したので18人
    expect(recruits).toHaveLength(18)
    expect(
      new Set(recruits.map((entry) => entry.member.combatStyle)).size
    ).toBe(18)
    for (const recruit of recruits) {
      expect(recruit.member.exploration).toBeDefined()
      expect(recruit.member.skills.length).toBeGreaterThan(0)
    }
  })
})
