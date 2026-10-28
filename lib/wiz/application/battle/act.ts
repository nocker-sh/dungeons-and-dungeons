import { SupplyRules } from "@/lib/wiz/rules/supply-rules"
import type { WizWorldEnvironment } from "@/lib/wiz/core/world/world"
import type { GameActionOf } from "@/lib/wiz/commands"
import { Bag } from "@/lib/wiz/rules/bag"
import { effectSpec } from "@/lib/wiz/rules/item-effect-spec"
import { skillSpec } from "@/lib/wiz/rules/skill-spec"
import type { ActionResult } from "@/lib/wiz/state/action-result"
import type { GameEvent } from "@/lib/wiz/state/game-event"
import type { GameState } from "@/lib/wiz/state/state-schema"
import { reject } from "@/lib/wiz/application/reject"
import type { Transition } from "@/lib/wiz/application/transition"
import { currentActor } from "@/lib/wiz/application/battle/current-actor"
import {
  Combat,
  type CombatDependencies,
} from "@/lib/wiz/application/battle/combat"

/** 仲間ひとりの指示（ワザ・防御・アイテム・殴る・ケイヤク）を一つ実行する。1行動ごとに1つの結果を返す。 */
export class Act {
  static readonly featureId = "W004"
  constructor(private readonly deps: CombatDependencies) {}

  execute(
    state: GameState,
    input: GameActionOf<"act">,
    environment: WizWorldEnvironment
  ): Transition {
    if (state.phase.type !== "battle") return reject("WRONG_PHASE")
    const phase = state.phase
    const actor = currentActor(phase.battle)
    if (actor.kind !== "member") return reject("NOT_YOUR_TURN")
    const member = state.members.find((entry) => entry.id === actor.id)
    if (!member || member.hp <= 0) return reject("NOT_YOUR_TURN")
    const combat = new Combat(
      this.deps,
      state,
      phase,
      environment.random,
      environment.nextId
    )
    let results: ActionResult[] | null = []
    let name = ""
    let paid = 0

    if (input.command === "skill" || input.command === "brawl") {
      const skill =
        input.command === "brawl"
          ? this.deps.party.skills.brawl()
          : input.skill
            ? this.deps.catalog.skill(input.skill)
            : undefined
      if (!skill) return reject("UNAVAILABLE")
      if (input.command === "brawl") {
        // 攻撃できるワザが残っている間は「殴る」を使えない
        if (!this.deps.party.skills.canBrawl(member, state))
          return reject("UNAVAILABLE")
      } else {
        if (
          !this.deps.party.skills.battleSkills(member, state).includes(skill.id)
        )
          return reject("UNAVAILABLE")
        // 流派の付いたキャラ固有のスキルは、その流派を使える仲間だけが選べる
        if (!this.deps.party.skills.canUseSchool(member, state, skill.id))
          return reject("NO_SCHOOL")
        const left = this.deps.party.skills.leftOf(member, state, skill.id)
        if (left !== null && left <= 0) return reject("NO_USES")
        // 自分を削って放つワザは、払えるHPが残っていないと選べない
        const cost = this.deps.party.sacrificeCost(member, state, skill.id)
        if (cost > 0 && member.hp <= cost) return reject("NO_HP")
        combat.member(member.id)!.used = this.deps.party.skills.spendUse(
          member,
          skill.id
        )
        paid = cost > 0 ? combat.pay(actor, cost) : 0
      }
      name = skill.name
      const spec = skillSpec(skill)
      // 主人公の固有スキルは合体する悪魔のワザ。悪魔のレベルで威力が上がる。
      // 流派が合体中の悪魔と合えば相性の分だけ上がり、後衛から近接のワザは下がる。
      const own =
        input.command === "skill" &&
        this.deps.party.magic.skills(member, state).includes(skill.id)
      const power =
        (own && this.deps.party.equipment.isHero(member)
          ? spec.power * this.deps.party.magic.demonPower(state)
          : spec.power) *
        this.deps.party.magic.affinityFactor(member, state, skill.id) *
        (spec.kind === "hit" && spec.reach
          ? this.deps.party.reachFactor(state, member.id, spec.reach)
          : 1)
      results = combat.apply(actor, { ...spec, power }, input.target)
    }
    if (input.command === "guard") {
      name = "防御"
      combat.guarding = [
        ...combat.guarding.filter((entry) => entry !== member.id),
        member.id,
      ]
      results = [{ target: actor, guarded: true }]
    }
    if (input.command === "pact") {
      // ケイヤク：契約している悪魔とのモードを変える。武器種・攻撃力・ワザが替わり、手番を使う
      if (!this.deps.party.equipment.isPact(member))
        return reject("UNAVAILABLE")
      const mode =
        input.mode === undefined
          ? undefined
          : this.deps.party.equipment.modesOf(member)[input.mode]
      if (!mode) return reject("UNKNOWN")
      if (!mode.open) return reject("LOCKED")
      if (mode.index === this.deps.party.equipment.modeOf(member))
        return reject("ALREADY")
      combat.member(member.id)!.mode = mode.index
      name = this.deps.catalog.good(mode.weapon)?.name ?? ""
      results = [{ target: actor }]
    }
    if (input.command === "item") {
      const good = input.good ? this.deps.catalog.good(input.good) : undefined
      if (!good || good.kind !== "item" || !good.effect)
        return reject("UNAVAILABLE")
      const supplies = Bag.remove(
        SupplyRules.packed(state, this.deps.catalog),
        good.id
      )
      if (!supplies) return reject("NO_ITEM")
      const rest = Bag.remove(combat.bag, good.id)
      if (!rest) return reject("NO_ITEM")
      const spec = effectSpec(good.effect)
      // 味方に使う道具は、効く相手だけを対象にする（効かない相手に使って無駄にしない）
      const allies = spec.target === "ally" || spec.target === "allies"
      const only = allies
        ? this.deps.party.itemTargets(state, good.effect)
        : undefined
      if (only && !only.length) return reject("NO_EFFECT")
      if (only && input.target && !only.includes(input.target))
        return reject("NO_EFFECT")
      combat.bag = rest
      combat.provisions = supplies
      name = good.name
      results = combat.apply(actor, spec, input.target, only)
    }
    if (!results) return reject("NO_TARGET")
    const acted: GameEvent = {
      type: "acted",
      actor,
      command: input.command,
      name,
      ...(input.command === "skill" ? { skill: input.skill } : {}),
      ...(input.command === "item" ? { good: input.good } : {}),
      ...(input.command === "pact" ? { mode: input.mode } : {}),
      ...(paid > 0 ? { paid } : {}),
      results,
    }
    return combat.finish(actor, acted)
  }
}
