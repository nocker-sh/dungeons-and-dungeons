import { Combat } from "@/lib/wiz/application/battle/combat"
import type { CombatDependencies } from "@/lib/wiz/application/battle/combat"
import type { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import type { GameState } from "@/lib/wiz/state/state-schema"
import { currentActor } from "@/lib/wiz/application/battle/current-actor"

type Props = Readonly<{
  previous: GameState
  state: GameState
  dependencies: CombatDependencies
  environment: WizWorldEnvironment
}>

/** 失われた旧編成の手番だけを、本番の状態異常・勝敗の規則で進める。 */
export function resumeMigratedBattle(props: Props): GameState {
  if (
    props.previous.phase.type !== "battle" ||
    props.state.phase.type !== "battle"
  )
    return props.state
  const actor = currentActor(props.previous.phase.battle)
  if (actor.kind !== "member" || props.state.party.includes(actor.id))
    return props.state
  const combat = new Combat(
    props.dependencies,
    props.state,
    props.state.phase,
    props.environment.random,
    props.environment.nextId
  )
  const result = combat.resume()
  if (!result.accepted) throw new Error("Cannot resume migrated battle")
  return result.state
}
