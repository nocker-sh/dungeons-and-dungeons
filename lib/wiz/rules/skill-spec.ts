import type { SkillDef } from "@/lib/wiz/content/content-schema"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import type { EffectSpec } from "@/lib/wiz/rules/effect-spec"

/** ワザの定義から効果の仕様へ。 */
export function skillSpec(skill: WizDeepReadonly<SkillDef>): EffectSpec {
  return {
    kind: skill.kind,
    power: skill.power ?? 1,
    drain: skill.drain,
    bonusAgainst: skill.bonusAgainst,
    target:
      skill.target ??
      (skill.kind === "hit" ? "foe" : skill.kind === "heal" ? "ally" : "self"),
    status: skill.status,
    cure: skill.cure,
    revive: skill.revive,
    reach: skill.reach,
    repair: skill.repair,
    school: skill.school,
    sacrifice: skill.sacrifice,
  }
}
