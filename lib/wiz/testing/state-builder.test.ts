import { describe, expect, it } from "vite-plus/test"
import { aState, GameStateBuilder } from "@/lib/wiz/testing/state-builder"
import { createTestGame } from "@/lib/wiz/testing/create-test-game"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { contentId } from "@/lib/wiz/testing/content-id"
import { foeBySlug } from "@/lib/wiz/testing/foe-by-slug"
import { memberBySlug } from "@/lib/wiz/testing/member-by-slug"
import { realContent } from "@/lib/wiz/testing/real-content"
import { startedState } from "@/lib/wiz/testing/started-state"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"

describe("場面の組み立て器（aState）", () => {
  it("存在しない仲間・装備の変更を拒否する", () => {
    const base = aState()
    expect(() => base.withMember("missing-member", { hp: 0 })).toThrow(
      "変更対象の仲間がいない"
    )
    expect(() => base.withMember("rivet", { hp: 0 })).toThrow(
      "変更対象の仲間がいない"
    )
    expect(() => base.withUses("rivet", [])).toThrow("変更対象の仲間がいない")
    expect(() => base.patchGear("missing-gear", { wear: 1 })).toThrow(
      "変更対象の装備がない"
    )
  })

  it("idで指定した仲間・装備だけを変更し、元の場面は変えない", () => {
    const base = aState().withEquipped("alda", "dagger")
    const before = base.build()
    const gear = before.gear.at(-1)!
    const alda = memberBySlug("alda").id
    const changed = base
      .withMember(alda, { hp: 1 })
      .patchGear(gear.id, { plus: 2 })
      .build()
    expect(changed.members.find((member) => member.id === alda)?.hp).toBe(1)
    expect(changed.gear.find((entry) => entry.id === gear.id)?.plus).toBe(2)
    expect(base.build()).toBe(before)
    expect(before.members.find((member) => member.id === alda)?.hp).not.toBe(1)
    expect(gear.plus).toBe(0)
  })

  it("はじめからの状態を元に、金貨と仲間だけを変える", () => {
    const state = aState().withGold(100).withMember("alda", { hp: 1 }).build()
    expect(state.gold).toBe(100)
    const alda = memberBySlug("alda")
    const mort = memberBySlug("mort")
    expect(state.members.find((member) => member.id === alda.id)?.hp).toBe(1)
    expect(state.members.find((member) => member.id === mort.id)?.hp).toBe(
      mort.stats.maxHp
    )
    expect(state.phase.type).toBe("town")
  })

  it("募集の仲間を初期装備つきで加え、指した仲間と同じ位置で出撃させる", () => {
    const base = aState()
    const state = base.withJoined("sion", { replacing: "mort" }).build()
    const sion = memberBySlug("sion")
    const mort = memberBySlug("mort")
    const before = base.build()
    expect(state.party).toEqual(
      before.party.map((id) => (id === mort.id ? sion.id : id))
    )
    expect(state.members.map((member) => member.id)).toEqual([
      ...before.members.map((member) => member.id),
      sion.id,
    ])
    expect(
      state.gear
        .filter((entry) => entry.owner === sion.id)
        .map((entry) => entry.good)
    ).toEqual([...(sion.weapon ? [sion.weapon] : []), ...(sion.gear ?? [])])
    const game = createTestGame({ state })
    expect(game.queries.member(game.state, sion.id)!.hp).toBe(
      game.queries.member(game.state, sion.id)!.maxHp
    )
    expect(() => base.withJoined("mort")).toThrow("もう雇っている")
  })

  it("つなげても元の組み立て器は変わらない", () => {
    const base = aState()
    const rich = base.withGold(9999)
    expect(base.build().gold).toBe(realContent().startingGold)
    expect(rich.build().gold).toBe(9999)
  })

  it("戦闘中の場面を作り、敵のHPはコンテンツから引く", () => {
    const state = aState()
      .inBattle({ foes: ["kamokutsu", "koburakuda"], order: ["alda", "foe-1"] })
      .build()
    if (state.phase.type !== "battle") throw new Error("戦闘で始まる")
    const kamokutsu = foeBySlug("kamokutsu")
    const koburakuda = foeBySlug("koburakuda")
    expect(state.phase.battle.foes).toEqual([
      {
        id: "foe-1",
        foe: kamokutsu.id,
        hp: kamokutsu.hp,
        maxHp: kamokutsu.hp,
        status: [],
      },
      {
        id: "foe-2",
        foe: koburakuda.id,
        hp: koburakuda.hp,
        maxHp: koburakuda.hp,
        status: [],
      },
    ])
    expect(state.phase.battle.order).toEqual([
      { kind: "member", id: memberBySlug("alda").id },
      { kind: "foe", id: "foe-1" },
    ])
    expect(state.phase.expedition.at).toBe("n1")
  })

  it("探索中の場面は渡した分だけ上書きする", () => {
    const state = aState()
      .inExpedition({
        layer: contentId("layer0"),
        at: "n7",
        visited: ["s", "n7"],
      })
      .build()
    if (state.phase.type !== "expedition") throw new Error("探索で始まる")
    expect(state.phase.expedition.at).toBe("n7")
    expect(state.phase.expedition.pending).toBeNull()
    expect(state.phase.expedition.loot).toEqual({ gold: 0, goods: [] })
  })

  it("袋・依頼・悪魔・募集の枠を決められる", () => {
    const state = aState()
      .withBag([{ good: contentId("potion"), count: 1 }])
      .withItem("bone", 4)
      .withQuest("q-mole", 3)
      .withDemons([{ id: "nui", lv: 2, exp: 0 }])
      .withBoard(["r-alma"])
      .build()
    expect(state.bag).toEqual([
      { good: contentId("potion"), count: 1 },
      { good: contentId("bone"), count: 4 },
    ])
    expect(state.quests).toEqual([
      { id: contentId("q-mole"), progress: 3, claimed: false },
    ])
    expect(state.demons).toEqual([{ id: contentId("nui"), lv: 2, exp: 0 }])
    expect(state.contract).toBe(contentId("nui"))
    expect(state.board).toEqual([contentId("r-alma")])
  })

  it("作った状態はそのままエンジンが受け取れる", () => {
    const state = aState().withGold(1234).inTown().build()
    const game = createTestGame({ state })
    expect(game.state.gold).toBe(1234)
    expect(game.queries.readiness(game.state).ready).toBe(true)
  })

  it("途中の状態からも組み立てられる", () => {
    const definition = new GameDefinition(realContent())
    const game = definition.create(undefined, startedState(definition))
    eventsOrThrow(game.send({ type: "depart", layer: contentId("layer0") }))
    const next = GameStateBuilder.from(game.state, definition.catalog)
      .withGold(5)
      .build()
    expect(next.gold).toBe(5)
    expect(next.phase.type).toBe("expedition")
  })
})
