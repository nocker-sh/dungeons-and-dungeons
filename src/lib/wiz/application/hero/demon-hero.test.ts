import { describe, expect, it } from "vite-plus/test"
import { GameCommandError, GameDefinition } from "@/lib/wiz"
import { ConversationRules } from "@/lib/wiz/conversations/conversation-rules"
import {
  contentId,
  createTestPlay,
  eventsOrThrow,
  realContent,
  testEnvironment,
} from "@/lib/wiz/testing"

const heroId = contentId("hero")
const loxId = contentId("lox")

describe("悪魔と戦う主人公", () => {
  it("自身は宿で成長せず、防具も装備できない。拒否で資産を変えない", () => {
    const { definition, game: original } = createTestPlay()
    const initial = {
      ...original.state,
      gold: 10000,
      members: original.state.members.map((member) => ({
        ...member,
        exp: 1000,
      })),
    }
    const game = definition.create(testEnvironment(), initial)
    const before = game.state.members.find((member) => member.id === heroId)!
    const armor = game.state.gear.find(
      (gear) => definition.catalog.good(gear.good)?.kind === "armor"
    )!
    const save = game.save()
    expect(
      game.send({ type: "equip", member: heroId, gear: armor.id })
    ).toBeInstanceOf(GameCommandError)
    expect(game.save()).toEqual(save)
    const room = definition.catalog.data.rooms.find((room) => room.levelUp)!
    const events = eventsOrThrow(game.send({ type: "rest", room: room.id }))
    const after = game.state.members.find((member) => member.id === heroId)!
    expect(after.stats).toEqual(before.stats)
    expect(after.lv).toBe(before.lv)
    expect(game.queries.member(game.state, heroId)!.levelUpReady).toBe(false)
    const rested = events.find((event) => event.type === "rested")!
    if (rested.type !== "rested") throw new Error("宿の結果なし")
    expect(rested.levelUps.some((entry) => entry.member === heroId)).toBe(false)
    // 主人公以外の出撃の2人だけが成長する
    expect(rested.levelUps.length).toBe(2)
    expect(game.queries.member(game.state, heroId)!.armor).toBeNull()
  })

  it("旧保存の主人公防具を袋へ戻し、旧能力成長を戦闘に使わず、元データを壊さない", () => {
    const { definition, game } = createTestPlay()
    const saved = JSON.parse(JSON.stringify(game.save()))
    const armor = saved.snapshot.gear.find(
      (gear: { good: string }) =>
        definition.catalog.good(gear.good)?.kind === "armor"
    )
    armor.owner = heroId
    const hero = saved.snapshot.members.find(
      (member: { id: string }) => member.id === heroId
    )
    hero.stats = { maxHp: 900, str: 99, tec: 99, spd: 99 }
    const original = JSON.stringify(saved)
    expect(game.restore(saved)).toBeUndefined()
    expect(JSON.stringify(saved)).toBe(original)
    expect(
      game.state.gear.find((gear) => gear.id === armor.id)!.owner
    ).toBeNull()
    expect(game.queries.member(game.state, heroId)!.base).toEqual(
      definition.catalog.member(heroId)!.stats
    )
    expect(game.queries.member(game.state, heroId)!.maxHp).toBeLessThan(900)
    expect(game.state.gold).toBe(saved.snapshot.gold)
    expect(game.state.bag).toEqual(saved.snapshot.bag)
  })

  it("見た目の変更は能力に影響せず、ロクスのレベルが合体の力を上げる", () => {
    const { definition, game: original } = createTestPlay()
    const initial = {
      ...original.state,
      demons: [{ id: loxId, lv: 1, exp: 0 }],
      contract: loxId,
    }
    const game = definition.create(testEnvironment(), initial)
    const before = game.queries.member(game.state, heroId)!
    eventsOrThrow(
      game.send({ type: "choose-hero-look", look: realContent().hero.looks[1] })
    )
    const after = game.queries.member(game.state, heroId)!
    expect([
      after.maxHp,
      after.str,
      after.tec,
      after.spd,
      after.weapon!.attack,
    ]).toEqual([
      before.maxHp,
      before.str,
      before.tec,
      before.spd,
      before.weapon!.attack,
    ])
    const stronger = definition.create(testEnvironment(), {
      ...game.state,
      demons: [{ id: loxId, lv: 5, exp: 0 }],
    })
    expect(
      stronger.queries.member(stronger.state, heroId)!.maxHp
    ).toBeGreaterThan(before.maxHp)
    expect(
      stronger.queries.member(stronger.state, heroId)!.weapon!.attack
    ).toBeGreaterThan(before.weapon!.attack)
  })
  it("衣装は買わずに着替えられ、所持金・装備・能力を変えない。未知の衣装は断る", () => {
    const { game } = createTestPlay()
    const before = game.state
    const hero = game.queries.hero(before)
    const outfit = hero.outfits[0].id
    const stats = game.queries.member(before, heroId)!
    eventsOrThrow(
      game.send({ type: "choose-hero-look", look: hero.look, outfit })
    )
    expect(game.state.hero.outfit).toBe(outfit)
    expect(game.state.members).toEqual(before.members)
    expect(game.state.gear).toEqual(before.gear)
    expect(game.state.gold).toBe(before.gold)
    const after = game.queries.member(game.state, heroId)!
    expect([
      after.maxHp,
      after.str,
      after.tec,
      after.spd,
      after.weapon!.attack,
    ]).toEqual([
      stats.maxHp,
      stats.str,
      stats.tec,
      stats.spd,
      stats.weapon!.attack,
    ])
    const saved = game.save()
    expect(
      game.send({
        type: "choose-hero-look",
        look: hero.look,
        outfit: "unknown",
      })
    ).toBeInstanceOf(GameCommandError)
    expect(game.save()).toEqual(saved)
    expect(game.restore(JSON.parse(JSON.stringify(saved)))).toBeUndefined()
    expect(game.state.hero.outfit).toBe(outfit)
  })
})

describe("最初の相棒ロクスとの会話", () => {
  it("初回会話から選択肢で返事し、未読を優先して違う会話を楽しめる。保存して続けられる", () => {
    const definition = new GameDefinition(realContent())
    const initial = definition.initialState()
    const game = definition.create(testEnvironment({ random: 0 }), {
      ...initial,
      hero: { ...initial.hero, registrationPending: false },
      phase: { type: "town" },
    })
    expect(game.queries.hero(game.state).companion?.canTalk).toBe(true)
    eventsOrThrow(
      game.send({
        type: "start-conversation",
        trigger: "talk",
        resident: loxId,
      })
    )
    expect(game.state.conversation?.active).toBe("lox-first-partner")
    eventsOrThrow(game.send({ type: "finish-conversation", choice: 1 }))
    expect(game.state.conversation?.flags).toContain("lox:met")
    const seen = new Set<string>()
    for (let index = 0; index < 10; index++) {
      eventsOrThrow(
        game.send({
          type: "start-conversation",
          trigger: "talk",
          resident: loxId,
        })
      )
      seen.add(game.state.conversation!.active!)
      eventsOrThrow(game.send({ type: "finish-conversation" }))
    }
    expect(seen.size).toBe(10)
    const restored = definition.create()
    expect(
      restored.restore(JSON.parse(JSON.stringify(game.save())))
    ).toBeUndefined()
    expect(restored.state.conversation).toEqual(game.state.conversation)
    expect(restored.state.stones).toBe(initial.stones)
  })

  it("相棒の物語は前の会話・夜・到達層・踏破で進み、未所持には出さない", () => {
    const definition = new GameDefinition(realContent())
    const initial = definition.initialState()
    const rules = new ConversationRules(definition.catalog)
    const story = definition.catalog.data.conversations!.filter((entry) =>
      entry.id.startsWith("lox-story-")
    )
    expect(story.length).toBe(7)
    let state = {
      ...initial,
      nights: 10,
      reached: 4,
      cleared: true,
      conversation: { seen: [], last: null, active: null, flags: ["lox:met"] },
    }
    for (const script of story) {
      expect(rules.reasons(state, "talk", script, { resident: loxId })).toEqual(
        []
      )
      expect(
        rules.reasons({ ...state, demons: [] }, "talk", script, {
          resident: loxId,
        })
      ).toContain(`未契約:${loxId}`)
      state = {
        ...state,
        conversation: {
          ...state.conversation,
          flags: [...state.conversation.flags, ...script.sets],
        },
      }
    }
    const last = story.at(-1)!
    expect(rules.reasons({ ...state, cleared: false }, "talk", last)).toContain(
      "未踏破"
    )
    const first = story[0]
    expect(rules.reasons({ ...state, nights: 0 }, "talk", first)).toContain(
      "夜の数が足りない"
    )
  })
})
