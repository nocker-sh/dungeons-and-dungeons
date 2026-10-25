import { describe, expect, it } from "vite-plus/test"
import {
  MOCK_CONTENT,
  MOCK_SHOP_DIALOGUE_SERVICE,
  MOCK_VAULT,
} from "@/lib/wiz/core/mocks/mock-vault"
import { WizConversationAffinitySystem } from "@/lib/wiz/core/engine/conversation/affinity-system"
import { createMockInventoryService, withMockInventory } from "@/lib/wiz/core/mocks/mock-inventory"
import { WizSceneTransitionService } from "@/lib/wiz/core/runtime/scene-transition-service"
import { MOCK_BATTLE_AUTHORITIES } from "@/lib/wiz/core/mocks/mock-battle-authorities"
import { toConversationScene } from "@/lib/wiz/core/runtime/scene-transitions"
import { WizSceneConversationReducer } from "@/lib/wiz/core/runtime/scenes/conversation/reducer"
import {
  WizConversationProgress,
  WizStateConversation,
} from "@/lib/wiz/core/runtime/scenes/conversation/state"
import { presentWizConversationTranscript } from "@/lib/wiz/core/runtime/scenes/conversation/types"

const inventoryService = createMockInventoryService(undefined, "conversation-entry")
const reducer = new WizSceneConversationReducer({ inventoryService })
const transitionService = new WizSceneTransitionService({
  ...MOCK_BATTLE_AUTHORITIES,
  content: MOCK_CONTENT,
  shopDialogueService: MOCK_SHOP_DIALOGUE_SERVICE,
})
const reduce = (...args: Parameters<WizSceneConversationReducer["reduce"]>) =>
  transitionService.applyResult(reducer.reduce(...args)).state
const presentHistory = (state: WizStateConversation) =>
  presentWizConversationTranscript(state.transcript, state.vault.findNpc(state.npcId))

describe("conversation state でない場合", () => {
  it("そのまま返す", () => {
    const villageState = {
      type: "village" as const,
      selectedAction: null,
      vault: MOCK_VAULT,
    }

    const result = reduce(villageState as never, {
      type: "ADVANCE_DIALOGUE",
    })

    expect(result.type).toBe("village")
  })
})

describe("ADVANCE_DIALOGUE", () => {
  it("ダイアログが進む", () => {
    const npc = MOCK_VAULT.npcs[0]
    if (!npc) return

    const state = toConversationScene(MOCK_VAULT, npc.id)

    const result = reduce(state, { type: "ADVANCE_DIALOGUE" })

    expect(result.type).toBe("conversation")
    if (result.type === "conversation") {
      expect(result.dialogueIndex).toBeGreaterThanOrEqual(1)
      expect(presentHistory(result).length).toBeGreaterThan(presentHistory(state).length)
    }
  })

  it("ダイアログが最終行に達したら dialogueCompleted が true になる", () => {
    const npc = MOCK_VAULT.npcs[0]
    if (!npc) return

    // elda の greeting ダイアログは 3行
    // toConversationScene は最初の1行を自動表示して dialogueIndex=1 にする
    // 残り2回 ADVANCE_DIALOGUE すれば最終行に達する
    let state = toConversationScene(MOCK_VAULT, npc.id)

    const dialogue = state.getCurrentDialogue()
    if (!dialogue) return
    // dialogueIndex が dialogue.lines.length 以上になるまで進める
    const remaining = dialogue.lines.length - state.dialogueIndex
    for (let i = 0; i < remaining; i++) {
      state = reduce(state, { type: "ADVANCE_DIALOGUE" }) as WizStateConversation
    }

    expect(state.type).toBe("conversation")
    if (state.type === "conversation") {
      expect(state.dialogueCompleted).toBe(true)
      expect(state.dialogueIndex).toBe(dialogue.lines.length)
      expect(presentHistory(state).length).toBe(dialogue.lines.length)
    }
  })
})

describe("SELECT_DIALOGUE_OPTION", () => {
  it("effects が適用される", () => {
    const npcId = "elda"
    // options と effects 付きのダイアログを持つ NPC を作成
    const vaultWithOptions = MOCK_VAULT.withNpcs(
      MOCK_VAULT.npcs.map((n) => {
        if (n.id !== npcId) return n
        return {
          ...n,
          dialogues: [
            {
              id: "test-dialogue",
              minAffinity: 0,
              lines: [{ speaker: n.name, text: "どうする?" }],
              options: [
                {
                  id: "help",
                  text: "手伝う",
                  affinityChange: 5,
                  effects: {
                    setFlags: ["helped_elda"],
                    giveItems: [{ itemId: "herb", quantity: 2 }],
                  },
                },
                {
                  id: "ignore",
                  text: "無視する",
                  affinityChange: -3,
                },
              ],
            },
          ],
        }
      }),
    )

    const state = toConversationScene(vaultWithOptions, npcId)

    const result = reduce(state, {
      type: "SELECT_DIALOGUE_OPTION",
      npcId,
      dialogueId: "test-dialogue",
      optionId: "help",
    })

    expect(result.type).toBe("conversation")
    if (result.type === "conversation") {
      expect(result.dialogueCompleted).toBe(true)
      // effects: setFlags
      expect(result.vault.hasFlag("helped_elda")).toBe(true)
      // effects: giveItems
      expect(result.vault.inventory.totalQuantity("item", "herb")).toBe(2)
      // affinityChange
      const updatedNpc = result.vault.npcs.find((n) => n.id === npcId)
      const originalNpc = vaultWithOptions.npcs.find((n) => n.id === npcId)
      expect(updatedNpc!.affinity).toBe(originalNpc!.affinity + 5)
      // history に選択肢テキストが追加される
      const lastHistory = presentHistory(result)[presentHistory(result).length - 1]
      expect(lastHistory).toEqual({
        type: "content",
        speaker: "player",
        text: "手伝う",
      })
    }
  })

  it("存在しない optionId の場合は状態が変わらない", () => {
    const npcId = "elda"
    const vaultWithOptions = MOCK_VAULT.withNpcs(
      MOCK_VAULT.npcs.map((n) => {
        if (n.id !== npcId) return n
        return {
          ...n,
          dialogues: [
            {
              id: "test-dialogue",
              minAffinity: 0,
              lines: [{ speaker: n.name, text: "どうする?" }],
              options: [{ id: "help", text: "手伝う" }],
            },
          ],
        }
      }),
    )

    const state = toConversationScene(vaultWithOptions, npcId)

    const result = reducer.reduce(state, {
      type: "SELECT_DIALOGUE_OPTION",
      npcId,
      dialogueId: "test-dialogue",
      optionId: "nonexistent",
    })

    expect(result).toMatchObject({
      accepted: false,
      reason: "DIALOGUE_OPTION_REJECTED",
    })
    expect(result.state).toBe(state)
  })

  it("option affinityChangeを注入したaffinity systemでクランプする", () => {
    const npcId = "elda"
    const boundedReducer = new WizSceneConversationReducer({
      affinitySystem: new WizConversationAffinitySystem({
        minimum: 10,
        maximum: 25,
        levels: [{ id: "bounded", minimum: 10 }],
      }),
      inventoryService,
    })
    const vault = MOCK_VAULT.withNpcs(
      MOCK_VAULT.npcs.map((npc) =>
        npc.id === npcId
          ? {
              ...npc,
              affinity: 20,
              dialogues: [
                {
                  id: "bounded-dialogue",
                  minAffinity: 0,
                  lines: [{ speaker: npc.name, text: "選んで" }],
                  options: [{ id: "raise", text: "上げる", affinityChange: 999 }],
                },
              ],
            }
          : npc,
      ),
    )
    const state = toConversationScene(vault, npcId)

    const result = boundedReducer.reduce(state, {
      type: "SELECT_DIALOGUE_OPTION",
      npcId,
      dialogueId: "bounded-dialogue",
      optionId: "raise",
    })

    expect(result.state.vault.findNpc(npcId)?.affinity).toBe(25)
    if (result.state.type === "conversation") {
      expect(result.state.transcript.at(-1)).toMatchObject({
        type: "option_selected",
        affinityDelta: 5,
      })
      expect(result.state.affinityGained).toBe(5)
    }
  })

  it("optionで関係段階が変わるとsemantic level logを残す", () => {
    const npcId = "elda"
    const vault = MOCK_VAULT.withNpcs(
      MOCK_VAULT.npcs.map((npc) =>
        npc.id === npcId
          ? {
              ...npc,
              affinity: 19,
              dialogues: [
                {
                  id: "level-dialogue",
                  minAffinity: 0,
                  lines: [{ speaker: npc.name, text: "選んで" }],
                  options: [{ id: "raise", text: "上げる", affinityChange: 1 }],
                },
              ],
            }
          : npc,
      ),
    )

    const result = reducer.reduce(toConversationScene(vault, npcId), {
      type: "SELECT_DIALOGUE_OPTION",
      npcId,
      dialogueId: "level-dialogue",
      optionId: "raise",
    })

    expect(result.state.vault.log.at(-1)).toEqual({
      key: "AFFINITY_LEVEL_CHANGED",
      npcId,
      level: "acquaintance",
    })
  })

  it("requirementsを満たさないoptionはeffectsごと拒否する", () => {
    const npcId = "elda"
    const vault = MOCK_VAULT.withNpcs(
      MOCK_VAULT.npcs.map((npc) =>
        npc.id === npcId
          ? {
              ...npc,
              dialogues: [
                {
                  id: "guarded-dialogue",
                  minAffinity: 0,
                  lines: [{ speaker: npc.name, text: "証を見せて" }],
                  options: [
                    {
                      id: "claim",
                      text: "持っている",
                      requirements: {
                        requiredFlags: ["has_pass"],
                        requiredItems: [{ itemId: "pass", quantity: 1 }],
                        minLevel: 2,
                      },
                      effects: {
                        setFlags: ["entered"],
                        giveItems: [{ itemId: "herb", quantity: 2 }],
                      },
                    },
                  ],
                },
              ],
            }
          : npc,
      ),
    )
    const state = toConversationScene(vault, npcId)

    const result = reducer.reduce(state, {
      type: "SELECT_DIALOGUE_OPTION",
      npcId,
      dialogueId: "guarded-dialogue",
      optionId: "claim",
    })

    expect(result).toMatchObject({
      accepted: false,
      reason: "DIALOGUE_OPTION_REJECTED",
    })
    expect(result.state).toBe(state)
    expect(result.state.vault.hasFlag("entered")).toBe(false)
    expect(result.state.vault.inventory.totalQuantity("item", "herb")).toBe(0)
  })

  it("takeItemsの複数種類の一部が不足する場合は選択を原子的に拒否する", () => {
    const npcId = "elda"
    const vault = withMockInventory(
      MOCK_VAULT.withNpcs(
        MOCK_VAULT.npcs.map((npc) =>
          npc.id === npcId
            ? {
                ...npc,
                dialogues: [
                  {
                    id: "trade",
                    minAffinity: 0,
                    lines: [{ speaker: npc.name, text: "交換する?" }],
                    options: [
                      {
                        id: "trade-twice",
                        text: "交換する",
                        affinityChange: 5,
                        effects: {
                          takeItems: [
                            { itemId: "herb", quantity: 1 },
                            { itemId: "apple", quantity: 1 },
                          ],
                          giveItems: [{ itemId: "potion", quantity: 1 }],
                          setFlags: ["traded"],
                        },
                      },
                    ],
                  },
                ],
              }
            : npc,
        ),
      ),
      [{ contentType: "item", contentId: "herb" }],
    )
    const state = toConversationScene(vault, npcId)

    const result = reducer.reduce(state, {
      type: "SELECT_DIALOGUE_OPTION",
      npcId,
      dialogueId: "trade",
      optionId: "trade-twice",
    })

    expect(result).toMatchObject({
      accepted: false,
      reason: "DIALOGUE_OPTION_REJECTED",
    })
    expect(result.state).toBe(state)
    expect(result.state.vault.inventory.totalQuantity("item", "herb")).toBe(1)
    expect(result.state.vault.inventory.totalQuantity("item", "potion") > 0).toBe(false)
    expect(result.state.vault.hasFlag("traded")).toBe(false)
    expect(result.state.vault.findNpc(npcId)?.affinity).toBe(state.vault.findNpc(npcId)?.affinity)
  })

  it("effects適用後にunlock receiptを残してresponseDialogueIdをpinする", () => {
    const npcId = "elda"
    const vault = MOCK_VAULT.withNpcs(
      MOCK_VAULT.npcs.map((npc) =>
        npc.id === npcId
          ? {
              ...npc,
              dialogues: [
                {
                  id: "entry",
                  minAffinity: 0,
                  lines: [{ speaker: npc.name, text: "秘密を聞く?" }],
                  options: [
                    {
                      id: "listen",
                      text: "聞く",
                      responseDialogueId: "secret",
                      effects: {
                        unlockDialogue: "secret",
                        setFlags: ["heard_secret"],
                      },
                    },
                  ],
                },
                {
                  id: "secret",
                  minAffinity: 0,
                  lines: [
                    { speaker: npc.name, text: "これは秘密だ" },
                    { speaker: npc.name, text: "誰にも言うな" },
                  ],
                },
              ],
            }
          : npc,
      ),
    )
    const state = toConversationScene(vault, npcId)
    expect(state.dialogueId).toBe("entry")

    const result = reducer.reduce(state, {
      type: "SELECT_DIALOGUE_OPTION",
      npcId,
      dialogueId: "entry",
      optionId: "listen",
    })

    expect(result.state.type).toBe("conversation")
    if (result.state.type !== "conversation") return
    expect(result.state.dialogueId).toBe("secret")
    expect(result.state.progress.phase).toBe("reading")
    expect(presentHistory(result.state).slice(-2)).toEqual([
      { type: "content", speaker: "player", text: "聞く" },
      {
        type: "content",
        speaker: "npc",
        sourceSpeaker: "エルダ",
        text: "これは秘密だ",
        emotion: undefined,
        portrait: undefined,
      },
    ])
    expect(result.state.vault.hasFlag("heard_secret")).toBe(true)

    const reopened = toConversationScene(result.state.vault, npcId)
    expect(reopened.dialogueId).toBe("secret")
  })
})

describe("SELECT_GIFT", () => {
  it("ギフト確認状態になる", () => {
    const npc = MOCK_VAULT.npcs[0]
    if (!npc) return

    const vaultWithItem = withMockInventory(MOCK_VAULT, [
      { contentType: "item", contentId: "herb" },
    ])
    const state = toConversationScene(vaultWithItem, npc.id)

    const result = reduce(state, {
      type: "SELECT_GIFT",
      itemId: "herb",
    })

    expect(result.type).toBe("conversation")
    if (result.type === "conversation") {
      expect(result.pendingGiftItemId).toBe("herb")
    }
  })

  it("存在しない NPC の場合は状態が変わらない", () => {
    const state = new WizStateConversation({
      type: "conversation",
      npcId: "nonexistent_npc",
      progress: WizConversationProgress.idle(),
      transcript: [],
      pendingGiftItemId: null,
      vault: MOCK_VAULT,
    })

    const result = reducer.reduce(state, {
      type: "SELECT_GIFT",
      itemId: "herb",
    })

    expect(result).toMatchObject({
      accepted: false,
      reason: "GIFT_SELECTION_REJECTED",
    })
    expect(result.state).toBe(state)
  })

  it("贈り物で選択条件を跨いでも開始時のdialogueIdを維持する", () => {
    const npcId = "elda"
    const vault = withMockInventory(
      MOCK_VAULT.withNpcs(
        MOCK_VAULT.npcs.map((npc) =>
          npc.id === npcId
            ? {
                ...npc,
                affinity: 19,
                dialogues: [
                  {
                    id: "before",
                    minAffinity: 0,
                    maxAffinity: 19,
                    lines: [
                      { speaker: npc.name, text: "まだ知り合いだ" },
                      { speaker: npc.name, text: "少しずつ話そう" },
                    ],
                  },
                  {
                    id: "after",
                    minAffinity: 20,
                    lines: [{ speaker: npc.name, text: "友人だ" }],
                  },
                ],
                giftPreferences: {
                  likes: ["herb"],
                  dislikes: [],
                },
              }
            : npc,
        ),
      ),
      [{ contentType: "item", contentId: "herb" }],
    )
    const started = toConversationScene(vault, npcId)
    expect(started.dialogueId).toBe("before")
    const pending = reduce(started, { type: "SELECT_GIFT", itemId: "herb" })
    const gifted = reduce(pending, { type: "CONFIRM_GIFT" })

    expect(gifted.type).toBe("conversation")
    if (gifted.type !== "conversation") return
    expect(gifted.vault.findNpc(npcId)?.affinity).toBe(29)
    expect(gifted.dialogueId).toBe("before")

    const advanced = reduce(gifted, { type: "ADVANCE_DIALOGUE" })
    expect(advanced.type).toBe("conversation")
    if (advanced.type !== "conversation") return
    expect(advanced.dialogueId).toBe("before")
    expect(presentHistory(advanced).at(-1)).toMatchObject({ text: "少しずつ話そう" })
  })
})

describe("END_CONVERSATION", () => {
  it("GO_TO_VILLAGE 遷移が発生する", () => {
    const npc = MOCK_VAULT.npcs[0]
    if (!npc) return

    const state = toConversationScene(MOCK_VAULT, npc.id)

    const result = reducer.reduce(state, { type: "END_CONVERSATION" })

    expect(result.transition).toBeDefined()
    expect(result.transition?.type).toBe("GO_TO_VILLAGE")
  })

  it("遷移適用後は village フェーズになる", () => {
    const npc = MOCK_VAULT.npcs[0]
    if (!npc) return

    const state = toConversationScene(MOCK_VAULT, npc.id)

    const result = reduce(state, { type: "END_CONVERSATION" })

    expect(result.type).toBe("village")
  })

  it("dialogueCompleted が false で最終行に達している場合は completeDialogue が呼ばれる", () => {
    const npc = MOCK_VAULT.npcs[0]
    if (!npc) return

    const initialState = toConversationScene(MOCK_VAULT, npc.id)

    const dialogue = initialState.getCurrentDialogue()
    if (!dialogue) return

    const state = initialState.withProgress(
      new WizConversationProgress({
        phase: "ready_to_complete",
        dialogueId: dialogue.id,
        nextLineIndex: dialogue.lines.length,
      }),
    )

    const result = reducer.reduce(state, { type: "END_CONVERSATION" })

    expect(result.transition?.type).toBe("GO_TO_VILLAGE")
    // completeDialogue が呼ばれて dialogueCompleted が true になる
    if (result.state.type === "conversation") {
      expect(result.state.dialogueCompleted).toBe(true)
    }
  })

  it("自動表示された1行会話の完了でもsemantic level logを残す", () => {
    const npcId = "elda"
    const vault = MOCK_VAULT.withNpcs(
      MOCK_VAULT.npcs.map((npc) =>
        npc.id === npcId
          ? {
              ...npc,
              affinity: 19,
              dialogues: [
                {
                  id: "single-line-dialogue",
                  minAffinity: 0,
                  lines: [{ speaker: npc.name, text: "またね" }],
                },
              ],
            }
          : npc,
      ),
    )
    const state = toConversationScene(vault, npcId)

    const result = reducer.reduce(state, { type: "END_CONVERSATION" })

    expect(result.state.vault.log.at(-1)).toEqual({
      key: "AFFINITY_LEVEL_CHANGED",
      npcId,
      level: "acquaintance",
    })
  })
})

describe("CANCEL_GIFT", () => {
  it("贈り物をキャンセルできる", () => {
    const npc = MOCK_VAULT.npcs[0]
    if (!npc) return

    const vaultWithItem = withMockInventory(MOCK_VAULT, [
      { contentType: "item", contentId: "herb" },
    ])
    const state = toConversationScene(vaultWithItem, npc.id)
    const stateWithGift = reduce(state, {
      type: "SELECT_GIFT",
      itemId: "herb",
    })

    const result = reduce(stateWithGift, { type: "CANCEL_GIFT" })

    expect(result.type).toBe("conversation")
    if (result.type === "conversation") {
      expect(result.pendingGiftItemId).toBeNull()
    }
  })
})

describe("CONFIRM_GIFT", () => {
  it("贈り物を確定するとアイテムが消費される", () => {
    const npc = MOCK_VAULT.npcs[0]
    if (!npc) return

    const vaultWithItem = withMockInventory(MOCK_VAULT, [
      { contentType: "item", contentId: "herb" },
    ])
    const state = toConversationScene(vaultWithItem, npc.id)
    const stateWithGift = reduce(state, {
      type: "SELECT_GIFT",
      itemId: "herb",
    })

    const result = reduce(stateWithGift, { type: "CONFIRM_GIFT" })

    expect(result.type).toBe("conversation")
    if (result.type === "conversation") {
      expect(result.pendingGiftItemId).toBeNull()
      expect(result.vault.inventory.totalQuantity("item", "herb") > 0).toBe(false)
      expect(presentHistory(result).slice(-2)).toEqual([
        { type: "gift_presented", itemId: "herb" },
        { type: "gift_reaction", reaction: "love" },
      ])
    }
  })

  it("pending gift がない場合は状態が変わらない", () => {
    const npc = MOCK_VAULT.npcs[0]
    if (!npc) return

    const state = toConversationScene(MOCK_VAULT, npc.id)

    const sceneResult = reducer.reduce(state, { type: "CONFIRM_GIFT" })
    const result = transitionService.applyResult(sceneResult).state

    expect(sceneResult).toMatchObject({
      accepted: false,
      reason: "GIFT_CONFIRMATION_REJECTED",
    })
    expect(result).toBe(state)
  })

  it("pending itemだけを保持し、確定時のcurrent contentでreactionを再解決する", () => {
    const npc = MOCK_VAULT.npcs[0]
    if (!npc) return
    const vault = withMockInventory(
      MOCK_VAULT.updateNpc(npc.id, (currentNpc) => ({
        ...currentNpc,
        affinity: 10,
      })),
      [{ contentType: "item", contentId: "herb" }],
    )
    const pending = toConversationScene(vault, npc.id).withPendingGiftItemId("herb")
    const state = pending.withVault(
      pending.vault.updateNpc(npc.id, (currentNpc) => ({
        ...currentNpc,
        giftPreferences: {
          likes: [],
          dislikes: ["herb"],
        },
      })),
    )

    const result = reduce(state, { type: "CONFIRM_GIFT" })

    expect(result.type).toBe("conversation")
    if (result.type !== "conversation") return
    expect(result.vault.findNpc(npc.id)?.affinity).toBe(5)
    expect(result.affinityGained).toBe(-5)
    expect(presentHistory(result).slice(-1)).toEqual([
      { type: "gift_reaction", reaction: "dislike" },
    ])
  })

  it("確定済みgiftはactual clamp差分と当時のreactionをreceiptとして保持する", () => {
    const npcId = "elda"
    const vault = withMockInventory(
      MOCK_VAULT.withNpcs(
        MOCK_VAULT.npcs.map((npc) =>
          npc.id === npcId
            ? {
                ...npc,
                affinity: 100,
                giftPreferences: { likes: ["herb"], dislikes: [] },
              }
            : npc,
        ),
      ),
      [{ contentType: "item", contentId: "herb" }],
    )
    const pending = reduce(toConversationScene(vault, npcId), {
      type: "SELECT_GIFT",
      itemId: "herb",
    })
    const result = reduce(pending, { type: "CONFIRM_GIFT" })

    expect(result.type).toBe("conversation")
    if (result.type !== "conversation") return
    expect(result.affinityGained).toBe(0)
    expect(result.transcript.at(-1)).toEqual({
      type: "gift_applied",
      itemId: "herb",
      reaction: "love",
      affinityDelta: 0,
    })

    const changedContent = result.withVault(
      result.vault.updateNpc(npcId, (npc) => ({
        ...npc,
        giftPreferences: { likes: [], dislikes: ["herb"] },
      })),
    )
    expect(presentHistory(changedContent).at(-1)).toEqual({
      type: "gift_reaction",
      reaction: "love",
    })
  })
})

describe("semantic rejection", () => {
  it("完了済みのダイアログを再度進めて好感度を重複加算しない", () => {
    const npc = MOCK_VAULT.npcs[0]
    if (!npc) return

    let state = toConversationScene(MOCK_VAULT, npc.id)
    const dialogue = state.getCurrentDialogue()
    if (!dialogue) return
    while (!state.dialogueCompleted) {
      state = reduce(state, { type: "ADVANCE_DIALOGUE" }) as WizStateConversation
    }

    const result = reducer.reduce(state, { type: "ADVANCE_DIALOGUE" })

    expect(result).toMatchObject({
      accepted: false,
      reason: "DIALOGUE_ADVANCE_REJECTED",
    })
    expect(result.state).toBe(state)
  })

  it("確認中の贈り物がない場合はキャンセルを拒否する", () => {
    const npc = MOCK_VAULT.npcs[0]
    if (!npc) return
    const state = toConversationScene(MOCK_VAULT, npc.id)

    const result = reducer.reduce(state, { type: "CANCEL_GIFT" })

    expect(result).toMatchObject({
      accepted: false,
      reason: "GIFT_CANCELLATION_REJECTED",
    })
    expect(result.state).toBe(state)
  })
})
