import { describe, expect, it } from "vite-plus/test"
import {
  createWizConversationDialogueUnlockFlag,
  WizEngineConversationDialogueSelector,
} from "@/lib/wiz/core/engine/conversation/dialogue-selector"
import { withMockInventory } from "@/lib/wiz/core/mocks/with-mock-inventory"
import { MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import type { WizVaultNpc } from "@/lib/wiz/core/vault/states/npc/type"
import type { WizVaultTimeState } from "@/lib/wiz/core/vault/states/time/schema"
import type { WizVaultValue } from "@/lib/wiz/core/vault/value"

const selector = new WizEngineConversationDialogueSelector()

const defaultTime: WizVaultTimeState = {
  day: 1,
  season: "spring",
  timeOfDay: "morning",
  weather: "sunny",
}

const createNpc = (
  affinity: number,
  dialogues: WizVaultNpc["dialogues"]
): WizVaultNpc => ({
  id: "test-npc",
  name: "テストNPC",
  affinity,
  dialogues,
})

type Context = Readonly<{
  time?: WizVaultTimeState
  flags?: readonly string[]
  completedQuestIds?: readonly string[]
  itemId?: string
  level?: number
}>

function createVault(npc: WizVaultNpc, context: Context = {}): WizVaultValue {
  let vault = MOCK_VAULT.withNpcs([npc])
    .withTime(context.time ?? defaultTime)
    .withFlags(context.flags ?? [])
    .updatePlayer((player) =>
      player.withLevel(context.level ?? MOCK_VAULT.player.level)
    )

  if (context.itemId) {
    vault = withMockInventory(vault, [
      { contentType: "item", contentId: context.itemId },
    ])
  }

  for (const questId of context.completedQuestIds ?? []) {
    const template = vault.quests[0]
    if (!template) throw new Error("A quest fixture is required")
    vault = vault.withQuests([
      ...vault.quests.filter((quest) => quest.id !== questId),
      { ...template, id: questId, completed: true },
    ])
  }

  return vault
}

const select = (npc: WizVaultNpc, context: Context = {}) =>
  selector.select({ npc, vault: createVault(npc, context) })

describe("select", () => {
  it("好感度を満たす台詞のうち minAffinity が最も高いものを返す", () => {
    const npc = createNpc(60, [
      { id: "greeting", minAffinity: 0, lines: [] },
      { id: "friendly", minAffinity: 20, lines: [] },
      { id: "close", minAffinity: 50, lines: [] },
      { id: "best", minAffinity: 80, lines: [] },
    ])

    expect(select(npc)?.id).toBe("close")
  })

  it("maxAffinity を超えた台詞は選ばない", () => {
    const npc = createNpc(60, [
      { id: "low-only", minAffinity: 0, maxAffinity: 30, lines: [] },
      { id: "generic", minAffinity: 0, lines: [] },
    ])

    expect(select(npc)?.id).toBe("generic")
  })

  it("条件を満たす台詞がなければ undefined を返す", () => {
    const npc = createNpc(10, [{ id: "best", minAffinity: 80, lines: [] }])

    expect(select(npc)).toBeUndefined()
  })

  it("時間帯が一致する台詞を汎用台詞より優先する", () => {
    const npc = createNpc(60, [
      { id: "close", minAffinity: 50, lines: [] },
      {
        id: "morning",
        minAffinity: 0,
        lines: [],
        triggers: { timeOfDay: ["morning"] },
      },
    ])

    expect(select(npc)?.id).toBe("morning")
    expect(
      select(npc, { time: { ...defaultTime, timeOfDay: "night" } })?.id
    ).toBe("close")
  })

  it("天候・季節が一致しない台詞は選ばない", () => {
    const npc = createNpc(60, [
      { id: "generic", minAffinity: 0, lines: [] },
      {
        id: "rainy",
        minAffinity: 0,
        lines: [],
        triggers: { weather: ["rainy"] },
      },
      {
        id: "winter",
        minAffinity: 0,
        lines: [],
        triggers: { season: ["winter"] },
      },
    ])

    expect(select(npc)?.id).toBe("generic")
    expect(
      select(npc, { time: { ...defaultTime, weather: "rainy" } })?.id
    ).toBe("rainy")
    expect(
      select(npc, { time: { ...defaultTime, season: "winter" } })?.id
    ).toBe("winter")
  })

  it("条件数が多い台詞を優先する", () => {
    const npc = createNpc(60, [
      {
        id: "rainy",
        minAffinity: 0,
        lines: [],
        triggers: { weather: ["rainy"] },
      },
      {
        id: "rainy-morning",
        minAffinity: 0,
        lines: [],
        triggers: { weather: ["rainy"], timeOfDay: ["morning"] },
      },
    ])

    expect(
      select(npc, { time: { ...defaultTime, weather: "rainy" } })?.id
    ).toBe("rainy-morning")
  })

  it("同じ条件数なら minAffinity が高い台詞を優先する", () => {
    const npc = createNpc(60, [
      {
        id: "morning-close",
        minAffinity: 50,
        lines: [],
        triggers: { timeOfDay: ["morning"] },
      },
      {
        id: "morning",
        minAffinity: 0,
        lines: [],
        triggers: { timeOfDay: ["morning"] },
      },
    ])

    expect(select(npc)?.id).toBe("morning-close")
  })

  it("afterQuest は完了済みクエストでのみ一致する", () => {
    const npc = createNpc(60, [
      { id: "generic", minAffinity: 0, lines: [] },
      {
        id: "after-slime",
        minAffinity: 0,
        lines: [],
        triggers: { afterQuest: "quest_slime_hunt" },
      },
    ])

    expect(select(npc)?.id).toBe("generic")
    expect(select(npc, { completedQuestIds: ["quest_slime_hunt"] })?.id).toBe(
      "after-slime"
    )
  })

  it("flags・item・levelを含む全requirements contextを評価する", () => {
    const npc = createNpc(60, [
      { id: "generic", minAffinity: 0, lines: [] },
      {
        id: "qualified",
        minAffinity: 0,
        lines: [],
        requirements: {
          requiredFlags: ["special_flag"],
          requiredItems: [{ itemId: "pass", quantity: 1 }],
          minLevel: 3,
        },
      },
    ])

    expect(
      select(npc, { flags: ["special_flag"], itemId: "pass", level: 2 })?.id
    ).toBe("generic")
    expect(
      select(npc, { flags: ["special_flag"], itemId: "pass", level: 3 })?.id
    ).toBe("qualified")
  })

  it("unlockDialogue targetはinternal receiptが付くまで通常選択しない", () => {
    const npc = createNpc(60, [
      {
        id: "entry",
        minAffinity: 0,
        lines: [],
        options: [
          {
            id: "unlock",
            text: "unlock",
            effects: { unlockDialogue: "secret" },
          },
        ],
      },
      { id: "secret", minAffinity: 50, lines: [] },
    ])

    expect(select(npc)?.id).toBe("entry")
    expect(
      select(npc, {
        flags: [createWizConversationDialogueUnlockFlag(npc.id, "secret")],
      })?.id
    ).toBe("secret")
  })
})
