import type { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import type { GameActionOf } from "@/lib/wiz/commands"
import type { GameState } from "@/lib/wiz/state/state-schema"
import { reject } from "@/lib/wiz/application/reject"
import type { Transition } from "@/lib/wiz/application/transition"
import { currentActor } from "@/lib/wiz/application/battle/current-actor"
import {
  Combat,
  type CombatDependencies,
} from "@/lib/wiz/application/battle/combat"

/**
 * プレイヤーが契約した悪魔を呼ぶ必殺技。1戦闘に1回、仲間の手番に使う。
 * 悪魔の攻撃のワザを敵全員へ放ち、その仲間の手番は消えない（続けて指示を選ぶ）。
 */
export class CallDemon {
  static readonly featureId = "W046"
  constructor(private readonly deps: CombatDependencies) {}

  execute(
    state: GameState,
    _input: GameActionOf<"call-demon">,
    environment: WizWorldEnvironment
  ): Transition {
    if (state.phase.type !== "battle") return reject("WRONG_PHASE")
    const phase = state.phase
    if (phase.battle.demonCalled) return reject("ALREADY")
    const actor = currentActor(phase.battle)
    if (actor.kind !== "member") return reject("NOT_YOUR_TURN")
    const member = state.members.find((entry) => entry.id === actor.id)
    if (!member || member.hp <= 0) return reject("NOT_YOUR_TURN")
    const demon = this.deps.party.magic.contracted(state)?.demon
    if (!demon) return reject("UNAVAILABLE")
    const call = this.deps.party.demonCall
    const skill = call.skillOf(demon.id)
    if (!skill) return reject("UNAVAILABLE")
    const combat = new Combat(
      this.deps,
      state,
      phase,
      environment.random,
      environment.nextId
    )
    const amount = this.deps.battle.damage(
      call.attack(state),
      call.power(demon.id),
      environment.random
    )
    const results = combat.apply(
      actor,
      { kind: "hit", power: 1, amount, target: "foes", reach: "ranged" },
      undefined
    )
    if (!results) return reject("NO_TARGET")
    return combat.hold(
      {
        type: "acted",
        actor,
        command: "demon",
        name: `${demon.name}「${skill.name}」`,
        skill: skill.id,
        demon: demon.id,
        results,
      },
      { demonCalled: true }
    )
  }
}
