import type { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import type { GameActionOf } from "@/lib/wiz/commands"
import { pick } from "@/lib/wiz/rules/pick"
import { skillSpec } from "@/lib/wiz/rules/skill-spec"
import type { GameEvent } from "@/lib/wiz/state/game-event"
import type { GameState } from "@/lib/wiz/state/state-schema"
import { reject } from "@/lib/wiz/application/reject"
import type { Transition } from "@/lib/wiz/application/transition"
import { currentActor } from "@/lib/wiz/application/battle/current-actor"
import {
  Combat,
  type CombatDependencies,
} from "@/lib/wiz/application/battle/combat"

/** 敵の手番。前衛を狙い、ときどきワザを使う。防御していれば被害は半分。 */
export class FoeTurn {
  static readonly featureId = "W005"
  constructor(private readonly deps: CombatDependencies) {}

  execute(
    state: GameState,
    _input: GameActionOf<"foe-turn">,
    environment: WizWorldEnvironment
  ): Transition {
    if (state.phase.type !== "battle") return reject("WRONG_PHASE")
    const phase = state.phase
    const actor = currentActor(phase.battle)
    if (actor.kind !== "foe") return reject("NOT_YOUR_TURN")
    const foeState = phase.battle.foes.find((foe) => foe.id === actor.id)
    const foe = foeState ? this.deps.catalog.foe(foeState.foe) : undefined
    if (!foeState || !foe || foeState.hp <= 0) return reject("NOT_YOUR_TURN")
    const random = environment.random
    const combat = new Combat(
      this.deps,
      state,
      phase,
      random,
      environment.nextId
    )
    const skills = (foe.skills ?? []).flatMap((id) => {
      const skill = this.deps.catalog.skill(id)
      return skill ? [skill] : []
    })
    const skill =
      skills.length > 0 && random() < (foe.skillRate ?? 0)
        ? pick(random, skills)
        : null
    const results = skill
      ? combat.apply(actor, skillSpec(skill), undefined)
      : combat.apply(
          actor,
          {
            kind: "hit",
            power: 1,
            target: "foe",
            reach: foe.attack?.reach ?? "melee",
          },
          undefined
        )
    if (!results) return reject("NO_TARGET")
    // 防御は敵の行動を一度受けるまで
    combat.guarding = []
    const acted: GameEvent = {
      type: "acted",
      actor,
      command: skill ? "skill" : "attack",
      name: skill
        ? (foe.skillNames?.[skill.id] ?? skill.name)
        : (foe.attack?.name ?? "攻撃"),
      ...(skill ? { skill: skill.id } : {}),
      results,
    }
    return combat.finish(actor, acted)
  }
}
