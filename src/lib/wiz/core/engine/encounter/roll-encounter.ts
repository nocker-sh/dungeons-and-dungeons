import { WizDice } from "@/lib/wiz/core/services/wiz-dice"
import type { WizVaultMonsterState } from "@/lib/wiz/core/vault/states/monster/schema"

export function rollEncounter(
  monsters: readonly WizVaultMonsterState[],
  dice: WizDice = new WizDice(),
): WizVaultMonsterState[] {
  if (monsters.length === 0) return []

  const enemyCount = dice.roll(1, 3).total
  const result: WizVaultMonsterState[] = []

  for (let i = 0; i < enemyCount; i++) {
    const randomMonster = dice.pick(monsters)
    if (randomMonster) {
      result.push({ ...randomMonster })
    }
  }

  return result
}
