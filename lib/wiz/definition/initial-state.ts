import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import { createMember } from "@/lib/wiz/members/create-member"
import { starterGear } from "@/lib/wiz/members/starter-gear"
import type { WeaponRules } from "@/lib/wiz/rules/weapon-rules"
import type { GameState } from "@/lib/wiz/state/state-schema"
import type { Random } from "@/lib/wiz/rules/random"

/**
 * はじめから。装備の個体IDは連番（環境のIDは使わず、毎回同じ初期状態にする）。
 * 作品が指定した初期仲間と最初の悪魔で開始する。追加の悪魔は契約書から呼び出す。
 */
export function createInitialState(
  catalog: GameCatalog,
  weapons: WeaponRules,
  random?: Random
): GameState {
  const data = catalog.data
  const companions = (data.startingCompanions ?? []).map((id) =>
    catalog.member(id)!
  )
  const starting = [...data.party, ...companions]
  let serial = 0
  const nextId = () => `starter-${++serial}`
  return {
    gold: data.startingGold,
    stones: data.startingStones,
    members: starting.map(createMember),
    party: starting.map((def) => def.id),
    bag: data.startingBag.map((entry) => ({ ...entry })),
    gear: starting.flatMap((def) => starterGear(def, nextId, weapons, random)),
    demons: data.startingDemon
      ? [{ id: data.startingDemon, lv: 1, exp: 0 }]
      : [],
    contract: data.startingDemon ?? null,
    hero: {
      name: data.hero.name,
      look: data.hero.looks[0],
      registrationPending: true,
    },
    reached: data.reached,
    lastLayer: null,
    cleared: false,
    endingSeen: false,
    wipe: null,
    quests: [],
    recruited: data.recruits
      .filter((entry) =>
        companions.some((member) => member.id === entry.member.id)
      )
      .map((entry) => entry.id),
    board: [...data.recruiting.initial],
    nights: 0,
    chatted: [],
    phase: { type: "creating" },
  }
}
