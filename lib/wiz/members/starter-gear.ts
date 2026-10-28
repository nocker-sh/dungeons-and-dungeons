import type { MemberDef } from "@/lib/wiz/content/content-schema"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import type { WeaponRules } from "@/lib/wiz/rules/weapon-rules"
import type { Gear } from "@/lib/wiz/state/state-schema"
import type { Random } from "@/lib/wiz/rules/random"

/** 最初から身に着けている装備を個体にする。乱数を渡すと武器の2枠を抽選する。 */
export function starterGear(
  def: WizDeepReadonly<MemberDef>,
  nextId: () => string,
  weapons: WeaponRules,
  random?: Random
): Gear[] {
  return [...(def.weapon ? [def.weapon] : []), ...(def.gear ?? [])].map(
    (good) => ({
      id: nextId(),
      good,
      owner: def.id,
      plus: 0,
      progress: 0,
      wear: 0,
      weapon: weapons.forGoodId(good, random),
    })
  )
}
