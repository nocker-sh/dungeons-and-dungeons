import { SupplyRules } from "@/lib/wiz/rules/supply-rules"
import type { GameActionOf } from "@/lib/wiz/commands"
import { Bag } from "@/lib/wiz/rules/bag"
import { Statuses } from "@/lib/wiz/rules/statuses"
import { usableInField } from "@/lib/wiz/rules/field-usable"
import type { ActionResult } from "@/lib/wiz/state/action-result"
import type { GameState, Member } from "@/lib/wiz/state/state-schema"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { accept } from "@/lib/wiz/application/accept"
import { reject } from "@/lib/wiz/application/reject"
import type { Transition } from "@/lib/wiz/application/transition"

type Mutable<T> = { -readonly [K in keyof T]: T[K] }

/** 街や探索中に、袋の道具を仲間に使う。対象を省くと一番弱っている者（蘇生なら倒れている者）。 */
export class Use {
  static readonly featureId = "W021"
  constructor(
    private readonly deps: Pick<GameDependencies, "catalog" | "party">
  ) {}

  execute(state: GameState, input: GameActionOf<"use">): Transition {
    if (state.phase.type !== "town" && state.phase.type !== "expedition")
      return reject("WRONG_PHASE")
    const good = this.deps.catalog.good(input.good)
    if (
      !good ||
      good.kind !== "item" ||
      !good.effect ||
      !usableInField(good.effect)
    )
      return reject("UNAVAILABLE")
    const supplies = Bag.remove(
      SupplyRules.available(state, this.deps.catalog),
      good.id
    )
    if (!supplies) return reject("NO_ITEM")
    const bag = Bag.remove(state.bag, good.id)
    if (!bag) return reject("NO_ITEM")
    const effect = good.effect
    const members: Mutable<Member>[] = state.members.map((member) => ({
      ...member,
    }))
    const party = members.filter((member) => state.party.includes(member.id))
    const max = (member: Member) => this.deps.party.stats(member, state)
    const revive = effect.type === "revive"
    // 効かない相手（回復しきっている・治す状態がないなど）には使わせず、道具も減らさない
    const affects = (member: Member) =>
      this.deps.party.itemAffects(member, state, effect)
    const pool = party.filter(
      (member) => (revive ? member.hp <= 0 : member.hp > 0) && affects(member)
    )
    const all = (effect.type === "heal" || effect.type === "cure") && effect.all
    const chosen = input.member
      ? pool.find((member) => member.id === input.member)
      : undefined
    if (input.member && !chosen)
      return reject(
        party.some((member) => member.id === input.member)
          ? "NO_EFFECT"
          : "NO_TARGET"
      )
    const targets = all
      ? pool
      : chosen
        ? [chosen]
        : pool
            .toSorted((a, b) => a.hp / max(a).maxHp - b.hp / max(b).maxHp)
            .slice(0, 1)
    if (!targets.length) return reject("NO_EFFECT")
    const results: ActionResult[] = targets.map((member) => {
      const target = { kind: "member" as const, id: member.id }
      const stats = max(member)
      if (effect.type === "heal" || effect.type === "revive") {
        const before = member.hp
        member.hp = Math.min(stats.maxHp, Math.max(0, member.hp) + effect.hp)
        return {
          target,
          heal: member.hp - before,
          ...(revive ? { revived: true } : {}),
        }
      }
      if (effect.type === "refill") {
        const { used, restored } = this.deps.party.skills.refillUses(
          member,
          effect.uses
        )
        member.used = used
        return { target, refill: restored }
      }
      if (effect.type === "cure") {
        const cured = member.status
          .filter((entry) => effect.kinds.includes(entry.kind))
          .map((entry) => entry.kind)
        member.status = Statuses.remove(member.status, cured)
        return { target, cured }
      }
      return { target }
    })
    return accept(
      {
        ...state,
        bag,
        members,
        ...(state.phase.type === "expedition" ? { provisions: supplies } : {}),
      },
      { type: "used", good: good.id, results }
    )
  }
}
