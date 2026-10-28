import { expect, test } from "vite-plus/test"
import { WizVaultNpcStateFactory } from "@/lib/wiz/core/vault/factory/npc-state-factory"

const mockNpcs = [
  {
    id: "elder",
    name: "Village Elder",
    occupation: "Elder",
    personality: "wise",
    initialAffinity: 50,
    dialogues: [
      { id: "greeting", minAffinity: 0, lines: ["Welcome, traveler."] },
      {
        id: "friendly",
        minAffinity: 50,
        lines: ["Good to see you again!", "How can I help?"],
      },
    ],
    likes: ["herb"],
    dislikes: ["monster_part"],
    likeBonus: 17,
    dislikeBonus: -9,
    neutralBonus: 2,
  },
  {
    id: "merchant",
    name: "Merchant",
    occupation: "Shop Owner",
    personality: "friendly",
    initialAffinity: 30,
    dialogues: [],
    likes: [],
    dislikes: [],
  },
]

test("getAll は NPC 一覧を返す", () => {
  const factory = new WizVaultNpcStateFactory({ defs: mockNpcs })

  const npcs = factory.getAll()

  expect(npcs).toHaveLength(2)
  expect(npcs[0].id).toBe("elder")
  expect(npcs[1].id).toBe("merchant")
})

test("affinity は initialAffinity で初期化される", () => {
  const factory = new WizVaultNpcStateFactory({ defs: mockNpcs })

  const npcs = factory.getAll()

  expect(npcs[0].affinity).toBe(50)
  expect(npcs[1].affinity).toBe(30)
})

test("dialogues の lines が WizSceneConversationDialogueLine に変換される", () => {
  const factory = new WizVaultNpcStateFactory({ defs: mockNpcs })

  const npcs = factory.getAll()
  const elder = npcs[0]

  expect(elder.dialogues).toHaveLength(2)
  expect(elder.dialogues[0].lines[0]).toEqual({
    speaker: "Village Elder",
    text: "Welcome, traveler.",
  })
})

test("完全形式の dialogue は options・requirements・effects・triggers を保持する", () => {
  const fullDialogue = {
    id: "question",
    minAffinity: 10,
    lines: [
      {
        speaker: "Narrator",
        text: "Choose carefully.",
        emotion: "serious",
        portrait: "narrator-serious",
      },
    ],
    triggers: {
      afterQuest: "quest1",
      timeOfDay: ["morning"],
    },
    requirements: {
      requiredItems: [{ itemId: "herb", quantity: 1 }],
    },
    options: [
      {
        id: "accept",
        text: "Accept",
        responseDialogueId: "answer",
        requirements: {
          requiredItems: [{ itemId: "herb", quantity: 1 }],
        },
        effects: {
          affinityChange: 2,
          giveItems: [{ itemId: "herb", quantity: 1 }],
          startQuest: "quest1",
          unlockDialogue: "answer",
        },
      },
    ],
  } as const
  const factory = new WizVaultNpcStateFactory({
    defs: [
      {
        ...mockNpcs[0],
        dialogues: [
          fullDialogue,
          {
            id: "answer",
            minAffinity: 0,
            lines: [{ speaker: "Village Elder", text: "Very well." }],
          },
        ],
      },
    ],
  })

  expect(factory.getAll()[0].dialogues[0]).toEqual(fullDialogue)
})

test("空 lines でも簡易形式の trigger と完全形式の options を判別する", () => {
  const factory = new WizVaultNpcStateFactory({
    defs: [
      {
        ...mockNpcs[0],
        dialogues: [
          {
            id: "silent",
            minAffinity: 0,
            lines: [],
            afterQuest: "quest1",
          },
          {
            id: "choice",
            minAffinity: 0,
            lines: [],
            options: [
              {
                id: "continue",
                text: "Continue",
                responseDialogueId: "silent",
              },
            ],
          },
        ],
      },
    ],
  })

  expect(factory.getAll()[0].dialogues[0]).toMatchObject({
    id: "silent",
    lines: [],
    triggers: { afterQuest: "quest1" },
  })
  expect(factory.getAll()[0].dialogues[1].options).toEqual([
    {
      id: "continue",
      text: "Continue",
      responseDialogueId: "silent",
    },
  ])
})

test("giftPreferences が設定される", () => {
  const factory = new WizVaultNpcStateFactory({ defs: mockNpcs })

  const npcs = factory.getAll()
  const elder = npcs[0]

  expect(elder.giftPreferences?.likes).toEqual(["herb"])
  expect(elder.giftPreferences?.dislikes).toEqual(["monster_part"])
  expect(elder.giftPreferences).toMatchObject({
    likeBonus: 17,
    dislikeBonus: -9,
    neutralBonus: 2,
  })
})

test("source と getter から変更できない deep readonly owned graph を返す", () => {
  const defs = [
    {
      id: "elder",
      name: "Village Elder",
      occupation: "Elder",
      personality: "wise",
      initialAffinity: 50,
      dialogues: [
        {
          id: "greeting",
          minAffinity: 0,
          lines: ["Welcome, traveler."],
        },
      ],
      likes: ["herb"],
      dislikes: ["monster_part"],
    },
  ]
  const factory = new WizVaultNpcStateFactory({ defs })

  defs[0].name = "Changed"
  defs[0].dialogues[0].lines[0] = "Changed"
  defs[0].likes[0] = "ore"

  const npcs = factory.getAll()
  const npc = npcs[0]
  const dialogueLine = npc.dialogues[0].lines[0]
  if (!npc.giftPreferences) {
    throw new Error("Expected NPC collections")
  }

  expect(Object.isFrozen(npcs)).toBe(true)
  expect(Object.isFrozen(npc)).toBe(true)
  expect(Object.isFrozen(npc.dialogues)).toBe(true)
  expect(Object.isFrozen(npc.dialogues[0])).toBe(true)
  expect(Object.isFrozen(dialogueLine)).toBe(true)
  expect(Object.isFrozen(npc.giftPreferences)).toBe(true)
  expect(Object.isFrozen(npc.giftPreferences.likes)).toBe(true)
  expect(npc.name).toBe("Village Elder")
  expect(dialogueLine.text).toBe("Welcome, traveler.")
  expect(npc.giftPreferences.likes).toEqual(["herb"])

  expect(Reflect.set(npc, "name", "Changed through getter")).toBe(false)
  expect(Reflect.set(dialogueLine, "text", "Changed through getter")).toBe(false)
  expect(Reflect.set(npc.giftPreferences.likes, 0, "ore")).toBe(false)

  expect(factory.getAll()[0].name).toBe("Village Elder")
  expect(factory.getAll()[0].dialogues[0].lines[0].text).toBe("Welcome, traveler.")
  expect(factory.getAll()[0].giftPreferences?.likes).toEqual(["herb"])
})
