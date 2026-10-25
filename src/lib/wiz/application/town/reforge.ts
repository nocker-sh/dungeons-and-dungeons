import type { GameActionOf } from "@/lib/wiz/commands"
import type { GameState } from "@/lib/wiz/state"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { inTown } from "@/lib/wiz/application/in-town"
import {
  accept,
  reject,
  type Transition,
} from "@/lib/wiz/application/transition"

/**
 * 鍛冶屋で、ユニークの仲間の固有の武器を鍛え直す。拾った武器（誰も着けていない個体）を素材にする。
 * 素材のレア度が高いほど手応え（progress）が大きく、`balance.unique.progressPerStep` たまるごとに一段上がる。
 * 防具も変えられない仲間（`fixedArmor`）は、段が上がると防具の段も同じだけ上がる（耐久が伸びる）。
 * 数値は仮（002-foundation-rules）。
 */
export class Reforge {
  static readonly featureId = "W026"
  constructor(
    private readonly deps: Pick<
      GameDependencies,
      "catalog" | "party" | "weapons"
    >
  ) {}

  execute(state: GameState, input: GameActionOf<"reforge">): Transition {
    if (!inTown(state)) return reject("WRONG_PHASE")
    const gear = state.gear.find((entry) => entry.id === input.gear)
    if (!gear) return reject("UNKNOWN")
    if (!this.deps.party.equipment.isFixedWeapon(gear))
      return reject("NOT_UNIQUE")
    const material = state.gear.find((entry) => entry.id === input.material)
    if (!material || material.id === gear.id) return reject("UNKNOWN")
    if (material.owner || material.unidentified) return reject("UNAVAILABLE")
    if (this.deps.catalog.good(material.good)?.kind !== "weapon")
      return reject("UNAVAILABLE")
    const rules = this.deps.catalog.data.balance.unique
    if (gear.plus >= rules.maxPlus) return reject("MAX")
    if (state.gold < rules.gold) return reject("NO_GOLD")
    const gained = this.deps.weapons.materialProgress(
      material.weapon?.rarity ?? null
    )
    let plus = gear.plus
    let progress = gear.progress + gained
    while (progress >= rules.progressPerStep && plus < rules.maxPlus) {
      progress -= rules.progressPerStep
      plus += 1
    }
    if (plus >= rules.maxPlus) progress = 0
    // 防具も変えられない仲間だけ、固有の武器が上がった段だけ防具の最大の耐久も伸ばす。
    // 防具を着替えられる仲間（R）の防具は鍛冶屋の強化で上げる
    const steps = plus - gear.plus
    const armor =
      gear.owner && this.deps.party.equipment.isArmorFixed({ id: gear.owner })
        ? state.gear.find(
            (entry) =>
              entry.owner === gear.owner &&
              this.deps.catalog.good(entry.good)?.kind === "armor"
          )
        : undefined
    return accept(
      {
        ...state,
        gold: state.gold - rules.gold,
        gear: state.gear
          .filter((entry) => entry.id !== material.id)
          .map((entry) => {
            if (entry.id === gear.id) return { ...entry, plus, progress }
            if (armor && entry.id === armor.id && steps > 0)
              return { ...entry, plus: entry.plus + steps }
            return entry
          }),
      },
      {
        type: "reforged",
        gear: gear.id,
        material: material.id,
        gained,
        plus,
        progress,
      }
    )
  }
}
