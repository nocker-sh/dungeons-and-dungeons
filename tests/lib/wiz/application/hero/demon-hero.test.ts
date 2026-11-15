import { describe, expect, it } from "vite-plus/test"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { ConversationRules } from "@/lib/wiz/conversations/conversation-rules"
import { contentId } from "@/lib/wiz/testing/content-id"
import { realContent } from "@/lib/wiz/testing/real-content"
import { catalogOf } from "@/lib/wiz/testing/catalog-of"
import { createTestPlay } from "@/lib/wiz/testing/create-test-play"
import { eventsOrThrow } from "@/lib/wiz/testing/events-or-throw"
import { testEnvironment } from "@/lib/wiz/testing/test-environment"

const heroId = contentId("hero")
const loxId = contentId("lox")

/** 出撃の3人の表示上の能力。主人公の見た目や悪魔では変わらないことを確かめる。 */
function partyStats(game: ReturnType<typeof createTestPlay>["game"]) {
  return game.queries
    .party(game.state)
    .map((member) => [
      member.id,
      member.maxHp,
      member.str,
      member.tec,
      member.spd,
      member.weapon?.attack ?? null,
    ])
}

describe("戦わない運営役の主人公", () => {
  it("主人公は仲間にいないので装備の対象にならず、宿の成長にも入らない。拒否で資産を変えない", () => {
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
    expect(game.queries.member(game.state, heroId)).toBeNull()
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
    const rested = events.find((event) => event.type === "rested")!
    if (rested.type !== "rested") throw new Error("宿の結果なし")
    expect(rested.levelUps.some((entry) => entry.member === heroId)).toBe(false)
    // 出撃の3人の仲間だけが成長する
    expect(rested.levelUps.map((entry) => entry.member).toSorted()).toEqual(
      game.state.party.toSorted()
    )
    expect(game.state.members.some((member) => member.id === heroId)).toBe(
      false
    )
  })

  it("主人公が戦っていた旧保存は、主人公を外して防具を袋へ戻し、初期の仲間を迎え、元データを壊さない", () => {
    const { definition, game } = createTestPlay()
    const saved = JSON.parse(JSON.stringify(game.save()))
    const mayu = contentId("mayu")
    const heroDef = definition.catalog.member(heroId)!
    // 旧保存：主人公・アルダ・モートの3人で、マユはまだいない
    saved.snapshot.members = [
      {
        id: heroId,
        lv: heroDef.lv,
        exp: 0,
        hp: 900,
        stats: { maxHp: 900, str: 99, tec: 99, spd: 99 },
        used: [],
        status: [],
        fatigue: 0,
        dirt: 0,
        like: 0,
      },
      ...saved.snapshot.members.filter(
        (member: { id: string }) => member.id !== mayu
      ),
    ]
    saved.snapshot.party = [
      heroId,
      ...saved.snapshot.party.filter((id: string) => id !== mayu),
    ]
    saved.snapshot.recruited = saved.snapshot.recruited.filter(
      (id: string) => definition.catalog.recruit(id)?.member.id !== mayu
    )
    saved.snapshot.gear = saved.snapshot.gear.filter(
      (gear: { owner: string | null }) => gear.owner !== mayu
    )
    const armor = saved.snapshot.gear.find(
      (gear: { good: string }) =>
        definition.catalog.good(gear.good)?.kind === "armor"
    )
    armor.owner = heroId
    const original = JSON.stringify(saved)
    expect(game.restore(saved)).toBeUndefined()
    expect(JSON.stringify(saved)).toBe(original)
    expect(game.state.members.some((member) => member.id === heroId)).toBe(
      false
    )
    expect(game.state.party).not.toContain(heroId)
    expect(game.state.party).toContain(mayu)
    expect(game.state.party).toHaveLength(3)
    expect(
      game.state.gear.find((gear) => gear.id === armor.id)!.owner
    ).toBeNull()
    expect(game.queries.member(game.state, heroId)).toBeNull()
    expect(game.queries.problems(game.state)).toEqual([])
    expect(game.state.gold).toBe(saved.snapshot.gold)
    expect(game.state.bag).toEqual(saved.snapshot.bag)
  })

  it("見た目の変更も、相棒の悪魔のレベルも、仲間の能力を変えない（合体は廃止）", () => {
    const { definition, game: original } = createTestPlay()
    const initial = {
      ...original.state,
      demons: [{ id: loxId, lv: 1, exp: 0 }],
      contract: loxId,
    }
    const game = definition.create(testEnvironment(), initial)
    const before = partyStats(game)
    eventsOrThrow(
      game.send({ type: "choose-hero-look", look: realContent().hero.looks[1] })
    )
    expect(game.state.hero.look).toBe(realContent().hero.looks[1])
    expect(game.state.members).toEqual(initial.members)
    expect(partyStats(game)).toEqual(before)
    const stronger = definition.create(testEnvironment(), {
      ...game.state,
      demons: [{ id: loxId, lv: 5, exp: 0 }],
    })
    expect(partyStats(stronger)).toEqual(before)
  })
  it("衣装は買わずに着替えられ、所持金・装備・仲間の能力を変えない。未知の衣装は断る", () => {
    const { game } = createTestPlay()
    const before = game.state
    const hero = game.queries.hero(before)
    const outfit = hero.outfits[0].id
    const stats = partyStats(game)
    eventsOrThrow(
      game.send({ type: "choose-hero-look", look: hero.look, outfit })
    )
    expect(game.state.hero.outfit).toBe(outfit)
    expect(game.state.members).toEqual(before.members)
    expect(game.state.gear).toEqual(before.gear)
    expect(game.state.gold).toBe(before.gold)
    expect(partyStats(game)).toEqual(stats)
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
    const definition = new GameDefinition(catalogOf(realContent()))
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
    const definition = new GameDefinition(catalogOf(realContent()))
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
