import type { Effect } from "@/lib/wiz/content"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import type { EffectSpec } from "@/lib/wiz/rules/effect-spec"

/** 道具の効果から効果の仕様へ。 */
export function effectSpec(effect: WizDeepReadonly<Effect>): EffectSpec {
  switch (effect.type) {
    case "heal":
      return {
        kind: "heal",
        power: 1,
        amount: effect.hp,
        target: effect.all ? "allies" : "ally",
      }
    case "refill":
      return { kind: "heal", power: 1, refill: effect.uses, target: "ally" }
    case "damage":
      return {
        kind: "hit",
        power: 1,
        amount: effect.amount,
        target: effect.all ? "foes" : "foe",
      }
    case "status":
      return {
        kind: "support",
        power: 1,
        status: effect.status,
        target:
          effect.target ??
          (effect.status.kind === "poison" || effect.status.kind === "bind"
            ? "foe"
            : "self"),
      }
    case "cure":
      return {
        kind: "support",
        power: 1,
        cure: effect.kinds,
        target: effect.all ? "allies" : "ally",
      }
    case "revive":
      return {
        kind: "heal",
        power: 1,
        amount: effect.hp,
        revive: true,
        target: "ally",
      }
  }
}
