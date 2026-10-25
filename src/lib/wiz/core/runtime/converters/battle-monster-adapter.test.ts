import { describe, expect, it } from "vite-plus/test"
import { WizBattleEnemyParty } from "@/lib/wiz/core/engine/battle/actors/enemy-party"
import { WizBattleMonster } from "@/lib/wiz/core/engine/battle/actors/monster"
import { WizSceneBattleMonsterAdapter } from "@/lib/wiz/core/runtime/converters/battle-monster-adapter"
import type { WizVaultMonsterState } from "@/lib/wiz/core/vault/states/monster/schema"

const createMonsterState = (
  overrides: Partial<WizVaultMonsterState> = {},
): WizVaultMonsterState => ({
  id: "goblin",
  name: "Goblin",
  hp: 30,
  maxHp: 30,
  attack: 8,
  defense: 3,
  agility: 6,
  expReward: 15,
  goldReward: 10,
  drops: [{ itemId: "herb", chance: 0.3 }],
  ...overrides,
})

const defaultAdapter = WizSceneBattleMonsterAdapter.createDefault()

describe("WizSceneBattleMonsterAdapter.fromMonster", () => {
  it("codex のモンスターデータから WizBattleMonster に変換できる", () => {
    const monsterState = createMonsterState()

    const monster = defaultAdapter.fromMonster(monsterState)

    expect(monster).toBeInstanceOf(WizBattleMonster)
    expect(monster.id).toBe("goblin_0")
    expect(monster.name).toBe("Goblin")
    expect(monster.groupId).toBe("goblin")
    expect(monster.status.resources.current("health")).toBe(30)
    expect(monster.status.resources.maximum("health")).toBe(30)
    expect(monster.status.attributes.value("attack")).toBe(8)
    expect(monster.status.attributes.value("defense")).toBe(3)
    expect(monster.status.attributes.value("speed")).toBe(6)
    expect(monster.effects.effects).toHaveLength(0)
  })

  it("index を指定して ID を生成できる", () => {
    const monsterState = createMonsterState()

    const monster0 = defaultAdapter.fromMonster(monsterState, 0)
    const monster1 = defaultAdapter.fromMonster(monsterState, 1)
    const monster5 = defaultAdapter.fromMonster(monsterState, 5)

    expect(monster0.id).toBe("goblin_0")
    expect(monster1.id).toBe("goblin_1")
    expect(monster5.id).toBe("goblin_5")
  })

  it("ドロップ情報が custom に含まれる", () => {
    const monsterState = createMonsterState({
      drops: [
        { itemId: "herb", chance: 0.3 },
        { itemId: "goblin-fang", chance: 0.1 },
      ],
    })

    const monster = defaultAdapter.fromMonster(monsterState)

    const custom = monster.custom
    expect(custom.expReward).toBe(15)
    expect(custom.goldReward).toBe(10)
    expect(custom.drops.length).toBe(2)
    expect(custom.drops[0].itemId).toBe("herb")
    expect(custom.drops[0].chance).toBe(0.3)
    expect(custom.drops[1].itemId).toBe("goblin-fang")
    expect(custom.drops[1].chance).toBe(0.1)
  })

  it("標準statusに報酬dataを重複保持しない", () => {
    const monster = defaultAdapter.fromMonster(createMonsterState())

    expect(monster.status.custom).toEqual({})
  })
})

describe("WizSceneBattleMonsterAdapter.enemiesFromMonsters", () => {
  it("enemiesFromMonstersをbindせず呼べ、実装を差し替えられない", () => {
    const adapter = WizSceneBattleMonsterAdapter.createDefault()
    const { enemiesFromMonsters } = adapter

    const enemies = enemiesFromMonsters([createMonsterState()])

    expect(enemies.getAllMonsters()).toHaveLength(1)
    expect(Object.isFrozen(adapter)).toBe(true)
    expect(Object.isFrozen(WizSceneBattleMonsterAdapter.prototype)).toBe(true)
    expect(Object.isFrozen(WizSceneBattleMonsterAdapter)).toBe(true)

    const verifyReadonly = () => {
      const replacementEnemiesFromMonsters = adapter.enemiesFromMonsters
      // @ts-expect-error enemiesFromMonstersはreadonly function property。
      adapter.enemiesFromMonsters = replacementEnemiesFromMonsters
    }
    void verifyReadonly
  })

  it("custom status factoryで全monsterの必須fieldを生成する", () => {
    const adapter = WizSceneBattleMonsterAdapter.define({
      statusCustom: (monster) => ({ magic: monster.agility * 2 }),
    })

    const enemyParty = adapter.enemiesFromMonsters([createMonsterState()])
    const magic: number = enemyParty.getAllMonsters()[0].status.custom.magic

    expect(magic).toBe(12)
  })

  it("単一種のモンスターからエネミーパーティを作成できる", () => {
    const goblin = createMonsterState()

    const enemyParty = defaultAdapter.enemiesFromMonsters([goblin, goblin])

    expect(enemyParty).toBeInstanceOf(WizBattleEnemyParty)
    expect(enemyParty.id).toBe("enemies")
    expect(enemyParty.groups.length).toBe(1)
    expect(enemyParty.groups[0].id).toBe("goblin")
    expect(enemyParty.groups[0].name).toBe("Goblin")
    expect(enemyParty.groups[0].members.length).toBe(2)
  })

  it("複数種のモンスターがグループ分けされる", () => {
    const goblin = createMonsterState({ id: "goblin", name: "Goblin" })
    const orc = createMonsterState({
      id: "orc",
      name: "Orc",
      hp: 80,
      maxHp: 80,
      attack: 18,
    })

    const enemyParty = defaultAdapter.enemiesFromMonsters([goblin, orc, goblin])

    expect(enemyParty.groups.length).toBe(2)

    const goblinGroup = enemyParty.groups.find((g) => g.id === "goblin")
    const orcGroup = enemyParty.groups.find((g) => g.id === "orc")

    expect(goblinGroup).toBeDefined()
    expect(goblinGroup!.members.length).toBe(2)
    expect(orcGroup).toBeDefined()
    expect(orcGroup!.members.length).toBe(1)
  })

  it("各モンスターに一意の ID が割り当てられる", () => {
    const goblin = createMonsterState()

    const enemyParty = defaultAdapter.enemiesFromMonsters([goblin, goblin, goblin])

    const allMonsters = enemyParty.getAllMonsters()
    const ids = allMonsters.map((m) => m.id)

    // 全て一意であること
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(3)
  })

  it("globalIndex で連番が付与される", () => {
    const goblin = createMonsterState({ id: "goblin", name: "Goblin" })
    const orc = createMonsterState({ id: "orc", name: "Orc" })

    const enemyParty = defaultAdapter.enemiesFromMonsters([goblin, goblin, orc])

    const allMonsters = enemyParty.getAllMonsters()
    expect(allMonsters[0].id).toBe("goblin_0")
    expect(allMonsters[1].id).toBe("goblin_1")
    expect(allMonsters[2].id).toBe("orc_2")
  })
})
