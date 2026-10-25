import { expect, test } from "vite-plus/test"
import { WizEngineBattleContext } from "@/lib/wiz/core/engine/battle/context"
import { WizEngineBattleSimpleEnemyAI } from "@/lib/wiz/core/engine/battle-ai/simple-enemy-ai"
import { wizMockMixedEnemyParty } from "@/lib/wiz/core/mocks/mock-enemy-party"
import { wizMockGoblin } from "@/lib/wiz/core/mocks/mock-monster"
import { wizMockFullParty } from "@/lib/wiz/core/mocks/mock-party"

const createContext = () =>
  new WizEngineBattleContext({
    id: "battle-1",
    turnNumber: 1,
    party: wizMockFullParty(),
    enemies: wizMockMixedEnemyParty(),
    executedActions: [],
    initiative: "none",
  })

test("selectActionをbindせず呼べ、実装を差し替えられない", () => {
  const ai = new WizEngineBattleSimpleEnemyAI({ strategy: "weakest" })
  const { selectAction } = ai

  const action = selectAction(wizMockGoblin(1), createContext())

  expect(action?.targetIds[0]).toBe("mage-1")
  expect(Object.isFrozen(ai)).toBe(true)
  expect(Object.isFrozen(WizEngineBattleSimpleEnemyAI.prototype)).toBe(true)
  expect(Object.isFrozen(WizEngineBattleSimpleEnemyAI)).toBe(true)

  const verifyReadonly = () => {
    const replacementSelectAction = ai.selectAction
    // @ts-expect-error selectActionはreadonly function property。
    ai.selectAction = replacementSelectAction
  }
  void verifyReadonly
})

test("selectAction はアクション可能なモンスターに攻撃アクションを返す", () => {
  const ai = new WizEngineBattleSimpleEnemyAI({ strategy: "random" })
  const context = createContext()
  const monster = wizMockGoblin(1)

  const action = ai.selectAction(monster, context)

  expect(action).not.toBeNull()
  expect(action?.type).toBe("attack")
  expect(action?.actorId).toBe("goblin-1")
})

test("selectAction はターゲット ID を返す", () => {
  const ai = new WizEngineBattleSimpleEnemyAI({ strategy: "random" })
  const context = createContext()
  const monster = wizMockGoblin(1)

  const action = ai.selectAction(monster, context)

  expect(action?.targetIds).toHaveLength(1)
  // ターゲットはパーティメンバーのいずれか
  const partyMemberIds = context.party.members.map((m) => m.id)
  const firstTargetId = action?.targetIds[0] ?? ""
  expect(partyMemberIds).toContain(firstTargetId)
})

test("weakest strategy は HP が最も低いターゲットを選ぶ", () => {
  const ai = new WizEngineBattleSimpleEnemyAI({ strategy: "weakest" })
  const party = wizMockFullParty()
  // ヒーラーは HP 70, メイジは HP 60
  const context = new WizEngineBattleContext({
    id: "battle-1",
    turnNumber: 1,
    party,
    enemies: wizMockMixedEnemyParty(),
    executedActions: [],
    initiative: "none",
  })
  const monster = wizMockGoblin(1)

  const action = ai.selectAction(monster, context)

  // メイジ (mage-1) が最も HP が低いはず
  expect(action?.targetIds[0]).toBe("mage-1")
})

test("strongest strategy は HP が最も高いターゲットを選ぶ", () => {
  const ai = new WizEngineBattleSimpleEnemyAI({ strategy: "strongest" })
  const context = createContext()
  const monster = wizMockGoblin(1)

  const action = ai.selectAction(monster, context)

  // ヒーロー (hero-1) が最も HP が高いはず (HP 100)
  expect(action?.targetIds[0]).toBe("hero-1")
})

test("パーティが全滅している場合は null を返す", () => {
  const ai = new WizEngineBattleSimpleEnemyAI({ strategy: "random" })
  const party = wizMockFullParty()
  // 全員倒す
  let defeatedParty = party
  for (const member of party.members) {
    defeatedParty = defeatedParty.withDamageToMember(
      member.id,
      member.status.resources.current("health"),
    )
  }
  const context = new WizEngineBattleContext({
    id: "battle-1",
    turnNumber: 1,
    party: defeatedParty,
    enemies: wizMockMixedEnemyParty(),
    executedActions: [],
    initiative: "none",
  })
  const monster = wizMockGoblin(1)

  const action = ai.selectAction(monster, context)

  expect(action).toBeNull()
})

test("モンスターが行動不能の場合は null を返す", () => {
  const ai = new WizEngineBattleSimpleEnemyAI({ strategy: "random" })
  const context = createContext()
  const monster = wizMockGoblin(1)
  // モンスターを死亡させる
  const deadMonster = monster.withDamage(monster.status.resources.current("health"))

  const action = ai.selectAction(deadMonster, context)

  expect(action).toBeNull()
})

test("デフォルト strategy は random", () => {
  const ai = new WizEngineBattleSimpleEnemyAI()

  expect(ai.strategy).toBe("random")
})
