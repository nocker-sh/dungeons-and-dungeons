import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { WeaponRules } from "@/lib/wiz/rules/weapon-rules"
import type { GameState } from "@/lib/wiz/state/state-schema"

/**
 * 専用の武器を持つことになった仲間（R）の古い保存を移行する。
 * 雇っている仲間が専用の武器を持っていなければ、今の武器を袋へ戻し（個体・強化はそのまま）、
 * 専用の武器（N・強化なし）を着ける。持っていれば何もしない。
 * 装備の個体 id は保存のたびに同じになるよう、仲間の id から作る。
 */
export function giveSignatureWeapons(
  state: GameState,
  catalog: GameCatalog,
  weapons: WeaponRules
): GameState {
  const missing = state.members.filter((member) => {
    const def = catalog.member(member.id)
    if (!def?.unique || !def.weapon) return false
    return !state.gear.some(
      (gear) => gear.owner === member.id && gear.good === def.weapon
    )
  })
  if (!missing.length) return state
  const ids = new Set(state.gear.map((gear) => gear.id))
  const added = missing.map((member) => {
    const good = catalog.member(member.id)!.weapon!
    let id = `${member.id}:signature-weapon`
    while (ids.has(id)) id += "+"
    ids.add(id)
    return {
      id,
      good,
      owner: member.id,
      plus: 0,
      progress: 0,
      wear: 0,
      weapon: weapons.forGoodId(good),
    }
  })
  const owners = new Set(missing.map((member) => member.id))
  return {
    ...state,
    gear: [
      ...state.gear.map((gear) =>
        gear.owner &&
        owners.has(gear.owner) &&
        catalog.good(gear.good)?.kind === "weapon"
          ? { ...gear, owner: null }
          : gear
      ),
      ...added,
    ],
  }
}
