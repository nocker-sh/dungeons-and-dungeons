import {
  WizSceneBattleCharacterAdapter,
  type WizSceneBattleCharacterAuthority,
} from "@/lib/wiz/core/runtime/converters/battle-character-adapter"
import {
  WizSceneBattleMonsterAdapter,
  type WizSceneBattleMonsterAuthority,
} from "@/lib/wiz/core/runtime/converters/battle-monster-adapter"

export const MOCK_BATTLE_AUTHORITIES: Readonly<{
  battleCharacterAdapter: WizSceneBattleCharacterAuthority<unknown, unknown>
  battleMonsterAdapter: WizSceneBattleMonsterAuthority<unknown, unknown>
}> = Object.freeze({
  battleCharacterAdapter: WizSceneBattleCharacterAdapter.createDefault(),
  battleMonsterAdapter: WizSceneBattleMonsterAdapter.createDefault(),
})
