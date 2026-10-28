import { describe, expect, it } from "vite-plus/test"
import { rollEncounter } from "@/lib/wiz/core/engine/encounter/roll-encounter"
import { WizDice } from "@/lib/wiz/core/services/wiz-dice"
import type { WizVaultMonsterState } from "@/lib/wiz/core/vault/states/monster/schema"

const createMonster = (id: string, name: string): WizVaultMonsterState => ({
  id,
  name,
  hp: 30,
  maxHp: 30,
  attack: 10,
  defense: 5,
  agility: 5,
  expReward: 10,
  goldReward: 5,
  drops: [],
})

const sampleMonsters: WizVaultMonsterState[] = [
  createMonster("slime", "スライム"),
  createMonster("goblin", "ゴブリン"),
  createMonster("wolf", "オオカミ"),
]

describe("rollEncounter", () => {
  it("エリアのモンスターからランダムに遭遇パーティが生成される", () => {
    const result = rollEncounter(sampleMonsters)

    expect(result.length).toBeGreaterThanOrEqual(1)
    for (const monster of result) {
      const found = sampleMonsters.find((m) => m.id === monster.id)
      expect(found).toBeDefined()
    }
  })

  it("返されるモンスターの数が1~3の範囲内", () => {
    for (let i = 0; i < 50; i++) {
      const result = rollEncounter(sampleMonsters)
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result.length).toBeLessThanOrEqual(3)
    }
  })

  it("返されるモンスターは元のオブジェクトのコピーである", () => {
    const result = rollEncounter(sampleMonsters)

    for (const monster of result) {
      const original = sampleMonsters.find((m) => m.id === monster.id)
      if (!original) throw new Error(`Monster not found: ${monster.id}`)
      expect(monster).not.toBe(original)
      expect(monster).toEqual(original)
    }
  })

  it("空のモンスターリストの場合は空配列を返す", () => {
    const result = rollEncounter([])

    expect(result).toEqual([])
  })

  it("モンスターが1種類の場合でもパーティが生成される", () => {
    const singleMonster = [createMonster("slime", "スライム")]
    const result = rollEncounter(singleMonster)

    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result.length).toBeLessThanOrEqual(3)
    for (const monster of result) {
      expect(monster.id).toBe("slime")
    }
  })

  it("同じ seed なら同じ遭遇パーティを生成する", () => {
    const first = rollEncounter(sampleMonsters, WizDice.withSeed(42))
    const second = rollEncounter(sampleMonsters, WizDice.withSeed(42))

    expect(first).toEqual(second)
  })
})
