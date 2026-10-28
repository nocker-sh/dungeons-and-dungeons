import type { GameActionOf } from "@/lib/wiz/commands"
import { Bag } from "@/lib/wiz/rules/bag"
import type { GameState } from "@/lib/wiz/state/state-schema"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { inTown } from "@/lib/wiz/application/in-town"
import { accept } from "@/lib/wiz/application/accept"
import { reject } from "@/lib/wiz/application/reject"
import type { Transition } from "@/lib/wiz/application/transition"

/**
 * 鍛冶屋で武器・防具を一段強化する。段ごとにお金と素材がかかり、上がる能力がそれぞれ1増える。
 * 武器のワザは `balance.weapon.usesPerPlus` 段ごとに最大の使用回数が1増える。
 * ユニークの固有の武器はこの強化では扱わず、「鍛え直し」（W026）で上げる。
 */
export class Upgrade {
  static readonly featureId = "W023"
  constructor(
    private readonly deps: Pick<GameDependencies, "catalog" | "party">
  ) {}

  execute(state: GameState, input: GameActionOf<"upgrade">): Transition {
    if (!inTown(state)) return reject("WRONG_PHASE")
    const gear = state.gear.find((entry) => entry.id === input.gear)
    if (!gear) return reject("UNKNOWN")
    if (gear.unidentified) return reject("UNAVAILABLE")
    if (this.deps.party.equipment.isFixedWeapon(gear))
      return reject("FIXED_GEAR")
    const cost = this.deps.catalog.data.smithy?.upgrades[gear.plus]
    if (!cost) return reject("MAX")
    if (state.gold < cost.gold) return reject("NO_GOLD")
    const bag = Bag.pay(state.bag, cost.materials)
    if (!bag) return reject("NO_MATERIALS")
    const plus = gear.plus + 1
    return accept(
      {
        ...state,
        gold: state.gold - cost.gold,
        bag,
        gear: state.gear.map((entry) =>
          entry.id === gear.id ? { ...entry, plus } : entry
        ),
      },
      { type: "upgraded", gear: gear.id, plus }
    )
  }
}
