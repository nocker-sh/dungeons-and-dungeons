import { describe, expect, it } from "vite-plus/test"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { gameEnvironment } from "@/lib/wiz/definition/game-environment"
import { realContent } from "@/lib/wiz/testing/real-content"
import { contentId } from "@/lib/wiz/testing/content-id"
import { ConversationRules } from "@/lib/wiz/conversations/conversation-rules"
import {
  conversationScenario,
  type ConversationScenario,
} from "@/development/conversations/scenario"
import { stateSchema } from "@/lib/wiz/state/state-schema"

const definition = new GameDefinition({
  ...realContent(),
  startingCompanions: [],
})
const rules = new ConversationRules(definition.catalog)
const config = (
  patch: Partial<ConversationScenario> = {}
): ConversationScenario => ({
  owned: [contentId("alda"), contentId("mayu")],
  party: [contentId("alda")],
  demons: [],
  reached: 0,
  cleared: false,
  trigger: "inn",
  seen: [],
  ...patch,
})
const state = (patch: Partial<ConversationScenario> = {}) =>
  conversationScenario(definition, config(patch))
const script = (id: string) =>
  definition.catalog.data.conversations!.find((entry) => entry.id === id)!

describe("会話の条件と進行", () => {
  it("会話の案内は台本と操作条件の両方を満たすときだけ出す", () => {
    const ready = state()
    expect(rules.canOffer(ready, "inn")).toBe(true)
    expect(rules.canOffer({ ...ready, nights: 0 }, "inn")).toBe(false)
    expect(
      rules.canOffer(
        {
          ...ready,
          conversation: { ...ready.conversation!, active: "alda-mayu-inn" },
        },
        "inn"
      )
    ).toBe(false)
    // 操作できる夜でも、条件を満たす台本がなければ案内しない。
    const content = realContent()
    const locked = new GameDefinition({
      ...content,
      conversations: content.conversations?.map((entry) => ({
        ...entry,
        minimumNights: 100,
      })),
    })
    const noScripts = new ConversationRules(locked.catalog)
    expect(noScripts.canStart(ready, "inn")).toBe(true)
    expect(noScripts.canOffer(ready, "inn")).toBe(false)
  })
  it("宿では控えの仲間も登場し、未所持は登場しない", () => {
    expect(rules.reasons(state(), "inn", script("alda-mayu-inn"))).toEqual([])
    expect(
      rules.reasons(
        state({ owned: [contentId("alda")] }),
        "inn",
        script("alda-mayu-inn")
      )
    ).toContain(`未所持:${contentId("mayu")}`)
  })
  it("探索では所持だけでは足りず、同行が必要", () => {
    expect(
      rules.reasons(
        state({ trigger: "chest" }),
        "chest",
        script("mayu-chest-01")
      )
    ).toContain(`同行していない:${contentId("mayu")}`)
    expect(
      rules.reasons(
        state({ trigger: "chest", party: [contentId("mayu")] }),
        "chest",
        script("mayu-chest-01")
      )
    ).toEqual([])
  })
  it("悪魔は契約済みが必要で、探索は現在の契約相手だけ", () => {
    const id = definition.catalog.data.demons[0].id
    const demonScript = definition.catalog.data.conversations!.find(
      (entry) => entry.trigger === "chest" && entry.participants.includes(id)
    )!
    expect(rules.reasons(state(), "chest", demonScript)).toContain(
      `未契約:${id}`
    )
    expect(
      rules.reasons(state({ demons: [id] }), "chest", demonScript)
    ).toEqual([])
    const another = definition.catalog.data.demons[1].id
    expect(
      rules.reasons(state({ demons: [another, id] }), "chest", demonScript)
    ).toContain(`契約中ではない:${id}`)
  })
  it("進行度の境界、一度限り、踏破を区別", () => {
    const conversation = script("alma-alda-inn")
    const owned = [contentId("alma"), contentId("alda")]
    expect(rules.reasons(state({ owned }), "inn", conversation)).toEqual([
      "進行度が足りない",
    ])
    expect(
      rules.reasons(state({ owned, reached: 1 }), "inn", conversation)
    ).toEqual([])
    expect(
      rules.reasons(
        state({ owned, reached: 1, seen: [conversation.id] }),
        "inn",
        conversation
      )
    ).toEqual(["一度限りの会話を既読"])
    expect(
      rules.reasons(
        state({ owned: [contentId("alma"), contentId("clef")] }),
        "inn",
        script("alma-clef-cleared")
      )
    ).toEqual(["未踏破"])
  })
  it("未読を優先し、全既読の後は直前を避ける", () => {
    const current = state()
    const available = rules.available(current, "inn")
    const lastUnread = available.at(-1)!
    const almost = {
      ...current,
      conversation: {
        active: null,
        last: null,
        seen: available.slice(0, -1).map((entry) => entry.id),
      },
    }
    expect(rules.select(almost, "inn", () => 0)?.id).toBe(lastUnread.id)
    const allRead = {
      ...almost,
      conversation: {
        active: null,
        last: lastUnread.id,
        seen: available.map((entry) => entry.id),
      },
    }
    expect(rules.select(allRead, "inn", () => 0.99)?.id).not.toBe(lastUnread.id)
    expect(rules.select(current, "inn", () => 0.4)).toEqual(
      rules.select(current, "inn", () => 0.4)
    )
  })
  it("[feature:W031] [feature:W032] 会話中は他操作を拒否し、終了時だけ既読にする。報酬は増やさない", () => {
    const initial = state({ trigger: "chest" })
    const game = definition.create(
      gameEnvironment({ random: () => 0 }),
      initial
    )
    expect(
      Array.isArray(game.send({ type: "start-conversation", trigger: "chest" }))
    ).toBe(true)
    const active = game.state.conversation!.active
    expect(active).toBeTruthy()
    expect(game.state.conversation!.seen).not.toContain(active)
    const before = game.state
    expect(Array.isArray(game.send({ type: "acknowledge" }))).toBe(false)
    expect(game.state).toBe(before)
    expect(Array.isArray(game.send({ type: "finish-conversation" }))).toBe(true)
    expect(game.state.conversation!.seen).toContain(active)
    expect(game.state.bag).toEqual(initial.bag)
    expect(game.state.gold).toBe(initial.gold)
    expect(Array.isArray(game.send({ type: "finish-conversation" }))).toBe(
      false
    )
  })
  it("別の場面で開始できず、古い保存も読める", () => {
    const initial = state()
    const { conversation: _conversation, ...legacy } = initial
    expect(stateSchema.safeParse(legacy).success).toBe(true)
    const game = definition.create(undefined, legacy)
    const before = game.state
    expect(
      Array.isArray(game.send({ type: "start-conversation", trigger: "chest" }))
    ).toBe(false)
    expect(game.state).toBe(before)
    const saved = game.save()
    expect(game.restore(saved)).toBeUndefined()
  })
  it("会話途中を保存復元して終了できる", () => {
    const game = definition.create(undefined, state())
    game.send({ type: "start-conversation", trigger: "inn" })
    const saved = game.save()
    const loaded = definition.create()
    expect(loaded.restore(saved)).toBeUndefined()
    expect(loaded.state.conversation?.active).toBe(
      game.state.conversation?.active
    )
    const choice = loaded.queries.activeConversation(loaded.state)?.choice
      ? 0
      : undefined
    expect(
      Array.isArray(loaded.send({ type: "finish-conversation", choice }))
    ).toBe(true)
  })
  it("不正な再生中の保存を拒否し、現在の状態を保持する", () => {
    const game = definition.create(undefined, state({ owned: [] }))
    const before = game.state
    const save = game.save()
    const result = game.restore({
      ...save,
      snapshot: {
        ...save.snapshot,
        conversation: { active: "alda-inn-01", last: null, seen: [] },
      },
    })
    expect(result?.code).toBe("INVALID_SAVE")
    expect(game.state).toBe(before)
  })
  it("台本の重複や登録外の話者は起動時に拒否", () => {
    const entry = script("alda-inn-01")
    expect(
      () =>
        new GameDefinition({ ...realContent(), conversations: [entry, entry] })
    ).toThrow("重複")
    expect(
      () =>
        new GameDefinition({
          ...realContent(),
          conversations: [
            {
              ...entry,
              lines: [
                { speaker: "missing", text: "テスト", expression: "talk" },
              ],
            },
          ],
        })
    ).toThrow("未登録")
  })
})

describe("会話の選択肢", () => {
  const withChoice = (speaker: string) => {
    const content = structuredClone(realContent())
    const conversation = content.conversations![0]
    conversation.choice = {
      ask: "どうする？",
      options: [
        {
          label: "進む",
          lines: [{ speaker, text: "行こう", expression: "talk" }],
        },
        {
          label: "戻る",
          lines: [{ speaker, text: "帰ろう", expression: "sigh" }],
        },
      ],
    }
    return content
  }
  it("答えの返事も会話の話者に限る", () => {
    const speaker = realContent().conversations![0].participants[0]
    expect(() => new GameDefinition(withChoice(speaker))).not.toThrow()
    expect(() => new GameDefinition(withChoice("nobody"))).toThrow(
      "未登録の話者 nobody"
    )
  })
})
