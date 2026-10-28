import type { BattleRules } from "@/lib/wiz/rules/battle-rules"
import type { EffectSpec } from "@/lib/wiz/rules/effect-spec"
import type { Random } from "@/lib/wiz/rules/random"
import type { ActorRef, Member } from "@/lib/wiz/state/state-schema"

type TargetContext = {
  living(side: ActorRef["kind"]): ActorRef[]
  fallen(side: ActorRef["kind"]): ActorRef[]
  party(): readonly Member[]
  armor(id: string): { wear: number } | undefined
  unit(ref: ActorRef): { ref: ActorRef; hp: number; maxHp: number } | null
}

/** 効果の対象だけを選び、被害・状態・乱数の規則は呼び出し元から受け取る。 */
export function resolveCombatTargets(
  context: TargetContext,
  rules: BattleRules,
  random: Random,
  actor: ActorRef,
  spec: EffectSpec,
  chosen: string | undefined,
  only?: readonly string[]
): ActorRef[] | null {
  const own = actor.kind
  const other = own === "member" ? "foe" : "member"
  /** only を渡した手（道具）は、効く相手だけを対象にする。 */
  const allowed = (refs: ActorRef[]) =>
    only ? refs.filter((ref) => only.includes(ref.id)) : refs
  if (spec.target === "self") return [actor]
  // 敵の全体攻撃も、近接なら前衛だけに届く
  if (spec.target === "foes" && own === "foe")
    return rules
      .reachable(context.party(), spec.reach ?? "melee")
      .map((entry) => ({ kind: "member" as const, id: entry.member.id }))
  if (spec.target === "foes") return context.living(other)
  if (spec.target === "allies")
    return allowed(spec.revive ? context.fallen(own) : context.living(own))
  if (spec.target === "foe") {
    const pool = context.living(other)
    if (!pool.length) return null
    if (own === "member")
      return [pool.find((ref) => ref.id === chosen) ?? pool[0]]
    const target = rules.target(context.party(), random, spec.reach ?? "melee")
    return target ? [{ kind: "member", id: target.id }] : null
  }
  // ally：味方ひとり。指定がなければ一番弱っている者（蘇生なら倒れている者）
  const pool = allowed(spec.revive ? context.fallen(own) : context.living(own))
  if (!pool.length) return null
  const picked = pool.find((ref) => ref.id === chosen)
  if (chosen !== undefined) return picked ? [picked] : null
  // 防具を直すワザは、耐久が一番減っている者
  if (spec.repair !== undefined) {
    const worn = pool
      .map((ref) => ({ ref, wear: context.armor(ref.id)?.wear ?? 0 }))
      .toSorted((a, b) => b.wear - a.wear)[0]
    return worn.wear > 0 ? [worn.ref] : [pool[0]]
  }
  return [
    pool
      .map((ref) => context.unit(ref)!)
      .toSorted((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0].ref,
  ]
}
