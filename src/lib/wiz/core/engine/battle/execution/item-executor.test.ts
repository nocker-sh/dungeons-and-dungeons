import { describe, expect, it } from "vite-plus/test"
import { createBattleEffect } from "@/lib/wiz/core/engine/battle/effects"
import { deriveEffectiveBattleState } from "@/lib/wiz/core/engine/battle/effects"
import { WizEngineBattleItemExecutor } from "@/lib/wiz/core/engine/battle/execution/item-executor"
import { createBattleItem } from "@/lib/wiz/core/engine/battle/item"
import { wizMockWeakEnemyParty } from "@/lib/wiz/core/mocks/mock-enemy-party"
import {
  wizMockAntidote,
  wizMockEther,
  wizMockPotion,
  wizMockRevive,
} from "@/lib/wiz/core/mocks/mock-item"
import { wizMockSoloParty } from "@/lib/wiz/core/mocks/mock-party"

describe("execute (回復アイテム)", () => {
  it("HPを回復できる", () => {
    const executor = new WizEngineBattleItemExecutor()
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const item = wizMockPotion() // power: 50

    // 先に60ダメージを与えておく (100 -> 40)
    const damagedParty = party.withDamageToMember("hero-1", 60)
    const initialHp = damagedParty.getMemberById("hero-1")?.status.resources.current("health") ?? 0
    expect(initialHp).toBe(40)

    const result = executor.execute(item, "hero-1", ["hero-1"], damagedParty, enemies)

    // 40 + 50 = 90
    const newHp = result.party.getMemberById("hero-1")?.status.resources.current("health") ?? 0
    expect(newHp).toBe(90)
    expect(result.logs).toContainEqual({
      key: "BATTLE_HEAL",
      targetId: "hero-1",
      amount: 50,
    })
  })

  it("アイテム使用ログが生成される", () => {
    const executor = new WizEngineBattleItemExecutor()
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const item = wizMockPotion()

    const result = executor.execute(item, "hero-1", ["hero-1"], party, enemies)

    expect(result.logs).toContainEqual({
      key: "BATTLE_ITEM",
      actorId: "hero-1",
      itemId: item.id,
      targetId: "hero-1",
    })
    expect(result.logs.some((log) => "actorName" in log || "itemName" in log)).toBe(false)
  })
})

describe("execute (MP回復アイテム)", () => {
  it("MPを回復できる", () => {
    const executor = new WizEngineBattleItemExecutor()
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const item = wizMockEther() // power: 30

    // 先にMPを消費しておく (30 -> 10)
    const member = party.getMemberById("hero-1")
    if (!member) throw new Error("Member not found")
    const reducedMpParty = party.withMember(member.withMpCost(20))
    const initialMp = reducedMpParty.getMemberById("hero-1")?.status.resources.current("mana") ?? 0
    expect(initialMp).toBe(10)

    const result = executor.execute(item, "hero-1", ["hero-1"], reducedMpParty, enemies)

    // 10 + 30 = 40, but maxMp is 30, so clamped to 30
    const newMp = result.party.getMemberById("hero-1")?.status.resources.current("mana") ?? 0
    expect(newMp).toBe(30) // 最大値でクランプされる
  })
})

describe("execute (状態異常回復アイテム)", () => {
  it("状態異常を回復できる", () => {
    const executor = new WizEngineBattleItemExecutor()
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const item = wizMockAntidote()

    // 先に状態異常を付与
    const poisonEffect = createBattleEffect({
      instanceId: "poison-1",
      effectId: "poison",
      source: { kind: "system", id: "item-executor-test" },
      name: "Poison",
      lifetime: { type: "turns", remaining: 3 },
    })
    const poisonedParty = party.withEffectToMember("hero-1", poisonEffect)

    const result = executor.execute(item, "hero-1", ["hero-1"], poisonedParty, enemies)

    expect(result.logs).toContainEqual({
      key: "BATTLE_EFFECTS_REMOVED",
      targetId: "hero-1",
      removal: {
        scope: "effect",
        effect: {
          source: "item",
          itemId: item.id,
          effectType: "poison",
        },
      },
    })
    expect(JSON.stringify(result.logs)).not.toContain("全ての状態異常")
  })
})

describe("execute (バフアイテム)", () => {
  it("基礎statusを変更せず、期限内だけ派生statusへバフを反映する", () => {
    const executor = new WizEngineBattleItemExecutor()
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const buffItem = createBattleItem({
      id: "item-power-herb",
      name: "Power Herb",
      description: "Raises attack.",
      itemType: "consumable",
      price: 10,
      sellPrice: 5,
      effect: { type: "buff", stat: "attack", value: 10, duration: 1 },
    })

    const result = executor.execute(buffItem, "hero-1", ["hero-1"], party, enemies)
    const baseAttack = party.getMemberById("hero-1")?.status.attributes.value("attack") ?? 0
    const buffedMember = result.party.getMemberById("hero-1")
    if (!buffedMember) throw new Error("Member not found")

    expect(result.logs).toContainEqual({
      key: "BATTLE_EFFECT_APPLIED",
      targetId: "hero-1",
      effect: {
        source: "item",
        itemId: buffItem.id,
        effectType: "attackUp",
      },
    })
    expect(buffedMember.status.attributes.value("attack")).toBe(baseAttack)
    expect(
      deriveEffectiveBattleState(buffedMember.status, buffedMember.effects).attributes.value(
        "attack",
      ),
    ).toBe(baseAttack + 10)

    const expiredMember = result.party.advanceEffects().getMemberById("hero-1")
    if (!expiredMember) throw new Error("Member not found")
    expect(expiredMember.effects.effects).toHaveLength(0)
    expect(
      deriveEffectiveBattleState(expiredMember.status, expiredMember.effects).attributes.value(
        "attack",
      ),
    ).toBe(baseAttack)
  })
})

describe("execute (ダメージアイテム)", () => {
  it("敵にダメージを与えられる", () => {
    const executor = new WizEngineBattleItemExecutor()
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const damageItem = createBattleItem({
      id: "item-bomb",
      name: "Bomb",
      description: "Deals damage.",
      itemType: "consumable",
      price: 10,
      sellPrice: 5,
      effect: { type: "damage", value: 10 },
    })
    const targetId = enemies.getAllAliveMonsters()[0].id
    const initialHp = enemies.getMonsterById(targetId)?.status.resources.current("health") ?? 0
    expect(initialHp).toBe(30) // ゴブリンのHP

    const result = executor.execute(damageItem, "hero-1", [targetId], party, enemies)

    const newHp = result.enemies.getMonsterById(targetId)?.status.resources.current("health") ?? 0
    expect(newHp).toBe(20) // 30 - 10 = 20
    expect(result.logs).toContainEqual({
      key: "BATTLE_DAMAGE",
      targetId,
      damage: 10,
    })
  })

  it("敵を倒すと死亡ログが生成される", () => {
    const executor = new WizEngineBattleItemExecutor()
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const damageItem = createBattleItem({
      id: "item-nuke",
      name: "Nuke",
      description: "Deals overwhelming damage.",
      itemType: "consumable",
      price: 999,
      sellPrice: 499,
      effect: { type: "damage", value: 9999 },
    })
    const targetId = enemies.getAllAliveMonsters()[0].id

    const result = executor.execute(damageItem, "hero-1", [targetId], party, enemies)

    expect(result.logs).toContainEqual({
      key: "BATTLE_DEATH",
      targetId,
    })
  })
})

describe("execute (蘇生アイテム)", () => {
  it("死亡したキャラクターを蘇生できる", () => {
    const executor = new WizEngineBattleItemExecutor()
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const item = wizMockRevive()

    // 先に戦闘不能にする
    const member = party.getMemberById("hero-1")
    if (!member) throw new Error("Member not found")
    const deadParty = party.withDamageToMember("hero-1", member.status.resources.current("health"))

    const result = executor.execute(item, "hero-1", ["hero-1"], deadParty, enemies)

    const revivedMember = result.party.getMemberById("hero-1")
    expect(revivedMember?.isDead()).toBe(false)
    expect(result.logs).toContainEqual({
      key: "BATTLE_HEAL",
      targetId: "hero-1",
      amount: Math.floor(member.status.resources.maximum("health") * 0.5),
    })
  })

  it("生存中のキャラクターには効果がない", () => {
    const executor = new WizEngineBattleItemExecutor()
    const party = wizMockSoloParty()
    const enemies = wizMockWeakEnemyParty()
    const item = wizMockRevive()

    const result = executor.execute(item, "hero-1", ["hero-1"], party, enemies)

    // 蘇生ログは発生しない (回復ログがない)
    const healLogs = result.logs.filter((e) => e.key === "BATTLE_HEAL")
    expect(healLogs.length).toBe(0)
  })
})
