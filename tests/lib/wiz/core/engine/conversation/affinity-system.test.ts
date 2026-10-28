import { describe, expect, it } from "vite-plus/test"
import {
  createWizStandardConversationAffinitySystem,
  WizConversationAffinitySystem,
} from "@/lib/wiz/core/engine/conversation/create-wiz-standard-conversation-affinity-system"
import { WizValueValidationError } from "@/lib/wiz/core/value-validation"
import type { WizVaultNpc } from "@/lib/wiz/core/vault/states/npc/type"

const system = createWizStandardConversationAffinitySystem()

const createNpc = (affinity: number): WizVaultNpc => ({
  id: "test-npc",
  name: "テストNPC",
  affinity,
  dialogues: [],
})

describe("changeAffinity", () => {
  it("好感度を増加させる", () => {
    const npc = createNpc(50)

    const result = system.changeAffinity(npc, 10, {
      type: "custom",
      id: "test",
    })

    expect(result.npc.affinity).toBe(60)
    expect(result.event.change).toBe(10)
    expect(result.event.previousAffinity).toBe(50)
    expect(result.event.newAffinity).toBe(60)
  })

  it("好感度を減少させる", () => {
    const npc = createNpc(50)

    const result = system.changeAffinity(npc, -20, {
      type: "custom",
      id: "test",
    })

    expect(result.npc.affinity).toBe(30)
    expect(result.event.change).toBe(-20)
  })

  it("最大値を超えない", () => {
    const npc = createNpc(95)

    const result = system.changeAffinity(npc, 20, {
      type: "custom",
      id: "test",
    })

    expect(result.npc.affinity).toBe(100)
    expect(result.event.change).toBe(5) // 実際の変化量
  })

  it("最小値を下回らない", () => {
    const npc = createNpc(5)

    const result = system.changeAffinity(npc, -20, {
      type: "custom",
      id: "test",
    })

    expect(result.npc.affinity).toBe(0)
    expect(result.event.change).toBe(-5)
  })

  it("理由がイベントに記録される", () => {
    const npc = createNpc(50)

    const result = system.changeAffinity(npc, 10, {
      type: "gift_received",
      itemId: "flower",
    })

    expect(result.event.reason).toEqual({
      type: "gift_received",
      itemId: "flower",
    })
    expect(Object.isFrozen(result.event.reason)).toBe(true)
    expect(Object.isFrozen(result.event)).toBe(true)
    expect(Object.isFrozen(result)).toBe(true)
  })
})

describe("getAffinityLevel", () => {
  it("標準level definitionをruntimeでも不変に保つ", () => {
    expect(Object.isFrozen(system.levels)).toBe(true)
    expect(Object.isFrozen(system.levels[0])).toBe(true)
    expect(system.getAffinityLevel(49)).toBe("acquaintance")
    expect(system.getAffinityLevel(50)).toBe("friend")
  })

  it("任意のlevel IDと閾値をliteral型で扱う", () => {
    const custom = new WizConversationAffinitySystem({
      minimum: -100,
      maximum: 100,
      levels: [
        { id: "hostile", minimum: -100 },
        { id: "trusted", minimum: 10 },
        { id: "bonded", minimum: 75 },
      ],
    })

    const level: "hostile" | "trusted" | "bonded" = custom.getAffinityLevel(80)
    expect(level).toBe("bonded")
    expect(custom.acceptsAffinity(-100)).toBe(true)
    expect(custom.acceptsAffinity(100)).toBe(true)
    expect(custom.acceptsAffinity(-101)).toBe(false)
    expect(custom.acceptsAffinity(Number.NaN)).toBe(false)
    expect(custom.getAffinityLevel(0)).toBe("hostile")
    expect(custom.getProgressToNextLevel(20)).toEqual({
      current: 10,
      required: 65,
      percent: 15,
    })
  })

  it("空・重複・非昇順のlevel definitionを拒否する", () => {
    expect(
      () =>
        new WizConversationAffinitySystem({
          minimum: 0,
          maximum: 100,
          levels: [],
        })
    ).toThrow(WizValueValidationError)
    expect(
      () =>
        new WizConversationAffinitySystem({
          minimum: 0,
          maximum: 100,
          levels: [
            { id: "same", minimum: 0 },
            { id: "same", minimum: 10 },
          ],
        })
    ).toThrow(WizValueValidationError)
    expect(
      () =>
        new WizConversationAffinitySystem({
          minimum: 0,
          maximum: 100,
          levels: [
            { id: "first", minimum: 0 },
            { id: "second", minimum: 0 },
          ],
        })
    ).toThrow(WizValueValidationError)
  })

  it("stranger (0-19)", () => {
    expect(system.getAffinityLevel(0)).toBe("stranger")
    expect(system.getAffinityLevel(19)).toBe("stranger")
  })

  it("acquaintance (20-49)", () => {
    expect(system.getAffinityLevel(20)).toBe("acquaintance")
    expect(system.getAffinityLevel(49)).toBe("acquaintance")
  })

  it("friend (50-79)", () => {
    expect(system.getAffinityLevel(50)).toBe("friend")
    expect(system.getAffinityLevel(79)).toBe("friend")
  })

  it("close_friend (80-99)", () => {
    expect(system.getAffinityLevel(80)).toBe("close_friend")
    expect(system.getAffinityLevel(99)).toBe("close_friend")
  })

  it("best_friend (100)", () => {
    expect(system.getAffinityLevel(100)).toBe("best_friend")
  })
})

describe("getProgressToNextLevel", () => {
  it("次のレベルまでの進捗を返す", () => {
    const progress = system.getProgressToNextLevel(30)

    expect(progress).not.toBeNull()
    expect(progress?.current).toBe(10) // 20からの進捗
    expect(progress?.required).toBe(30) // 50 - 20
    expect(progress?.percent).toBe(33)
  })

  it("最大レベルの場合はnullを返す", () => {
    const progress = system.getProgressToNextLevel(100)

    expect(progress).toBeNull()
  })
})

describe("getGiftAffinityChange", () => {
  it("好きなアイテムはデフォルトで+10", () => {
    const prefs = { likes: ["flower"], dislikes: [] }

    expect(system.getGiftAffinityChange(prefs, "flower")).toBe(10)
  })

  it("嫌いなアイテムはデフォルトで-5", () => {
    const prefs = { likes: [], dislikes: ["junk"] }

    expect(system.getGiftAffinityChange(prefs, "junk")).toBe(-5)
  })

  it("中立アイテムはデフォルトで+1", () => {
    const prefs = { likes: [], dislikes: [] }

    expect(system.getGiftAffinityChange(prefs, "herb")).toBe(1)
  })

  it("カスタムボーナスを使用できる", () => {
    const prefs = {
      likes: ["flower"],
      dislikes: ["junk"],
      likeBonus: 20,
      dislikeBonus: -10,
      neutralBonus: 3,
    }

    expect(system.getGiftAffinityChange(prefs, "flower")).toBe(20)
    expect(system.getGiftAffinityChange(prefs, "junk")).toBe(-10)
    expect(system.getGiftAffinityChange(prefs, "herb")).toBe(3)
  })
})

describe("resolveGift", () => {
  it("content上のlikeと表示reactionのloveを区別して正規結果を返す", () => {
    const resolution = system.resolveGift(
      {
        likes: ["flower"],
        dislikes: [],
        likeBonus: 17,
      },
      "flower"
    )

    expect(resolution).toEqual({
      preference: "like",
      reaction: "love",
      affinityChange: 17,
    })
    expect(Object.isFrozen(resolution)).toBe(true)
  })

  it("dislikeとneutralにも共通の既定値を適用する", () => {
    const prefs = { likes: [] as string[], dislikes: ["junk"] }

    expect(system.resolveGift(prefs, "junk")).toMatchObject({
      preference: "dislike",
      reaction: "dislike",
      affinityChange: -5,
    })
    expect(system.resolveGift(prefs, "herb")).toMatchObject({
      preference: "neutral",
      reaction: "neutral",
      affinityChange: 1,
    })
  })
})
