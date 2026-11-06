import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { PartyRules } from "@/lib/wiz/rules/party-rules"
import type { GameState } from "@/lib/wiz/state/state-schema"

/**
 * 悪魔と契約して戦うことになった仲間（R）の古い保存を移行する。
 * 契約の仲間は武器も防具も持たないので、着けている装備を外して袋へ戻す（個体・強化はそのまま）。
 * 専用の武器だった個体は、いまはモードの戦い方そのもの（持ち物ではない）なので取り除く。
 */
export function releasePactGear(
  state: GameState,
  catalog: GameCatalog,
  party: PartyRules
): GameState {
  const modeWeapons = (owner: string) =>
    new Set(
      (catalog.member(owner)?.pact?.modes ?? []).map((mode) => mode.weapon)
    )
  const held = state.gear.filter(
    (gear) => gear.owner && catalog.member(gear.owner)?.pact
  )
  if (!held.length) return state
  const owners = new Set(held.map((gear) => gear.owner))
  const next: GameState = {
    ...state,
    gear: state.gear.flatMap((gear) => {
      if (!gear.owner || !catalog.member(gear.owner)?.pact) return [gear]
      if (modeWeapons(gear.owner).has(gear.good)) return []
      return [{ ...gear, owner: null }]
    }),
  }
  return {
    ...next,
    members: next.members.map((member) => {
      if (!owners.has(member.id)) return member
      const maximum = party.stats(member, next).maxHp
      return member.hp > maximum ? { ...member, hp: maximum } : member
    }),
  }
}
