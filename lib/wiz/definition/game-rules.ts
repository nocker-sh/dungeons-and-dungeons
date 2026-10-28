import { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { BattleRules } from "@/lib/wiz/rules/battle-rules"
import { ExpeditionRules } from "@/lib/wiz/rules/expedition-rules"
import { PartyRules } from "@/lib/wiz/rules/party-rules"
import { WeaponRules } from "@/lib/wiz/rules/weapon-rules"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"

/** 差し替えたい計算規則だけを渡す。渡すときは rulesRevision を必ず付ける。 */
export type GameRules = Partial<Omit<GameDependencies, "catalog">>

/**
 * データと計算規則を一組にする。ここが規則の唯一の組み立て場所。
 * 渡された規則はそのまま使い、渡されなかったものだけ既定の規則を作る。
 */
export function createGameRules(
  catalog: GameCatalog,
  overrides: GameRules = {}
): GameDependencies {
  const weapons = overrides.weapons ?? new WeaponRules(catalog)
  const party = overrides.party ?? new PartyRules(catalog, weapons)
  return Object.freeze({
    catalog,
    party,
    weapons,
    battle: overrides.battle ?? new BattleRules(catalog, party),
    expedition: overrides.expedition ?? new ExpeditionRules(catalog),
  })
}
