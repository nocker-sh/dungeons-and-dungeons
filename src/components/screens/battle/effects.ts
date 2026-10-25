import type { ComicEffectId } from "@/components/canvas/comic-effect"
import assignments from "@/lib/concept/data/battle-effects.json"
import type { GoodDef, SkillDef, StatusKind } from "@/lib/wiz/content"

/** 絵柄の割り当ては作品側に置き、エンジンへ画像や演出を持ち込まない。 */
export function attackEffect(
  skill?: Pick<SkillDef, "id" | "reach">,
  item?: { effect?: Pick<NonNullable<GoodDef["effect"]>, "type"> }
): ComicEffectId {
  if (item?.effect?.type === "damage") return "comic-critical"
  const assigned = assignments.find((entry) => entry.skill === skill?.id)
  return (
    (assigned?.effect as ComicEffectId | undefined) ??
    (skill?.reach === "ranged" ? "comic-magic" : "comic-hit")
  )
}

export const statusEffects = {
  poison: "comic-poison",
  bind: "comic-bind",
  charge: "comic-charge",
  protect: "comic-guard",
  regen: "comic-regen",
  taunt: "comic-guard",
} satisfies Record<StatusKind, ComicEffectId>
