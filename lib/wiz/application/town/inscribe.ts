import type { GameActionOf } from "@/lib/wiz/commands"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { inTown } from "@/lib/wiz/application/in-town"
import { accept } from "@/lib/wiz/application/accept"
import { reject } from "@/lib/wiz/application/reject"
import type { Transition } from "@/lib/wiz/application/transition"
import { Bag } from "@/lib/wiz/rules/bag"
import type { GameState } from "@/lib/wiz/state/state-schema"

export class Inscribe {
  static readonly featureId = "W034"
  constructor(
    private readonly deps: Pick<GameDependencies, "catalog" | "weapons">
  ) {}

  execute(state: GameState, input: GameActionOf<"inscribe">): Transition {
    if (!inTown(state)) return reject("WRONG_PHASE")
    const gear = state.gear.find((entry) => entry.id === input.gear)
    const good = gear && this.deps.catalog.good(gear.good)
    const book = this.deps.catalog.data.smithy?.skillBook
    if (!gear?.weapon || !good || !book) return reject("UNKNOWN")
    if (gear.unidentified) return reject("UNAVAILABLE")
    if (!this.deps.weapons.pool(good).includes(input.skill))
      return reject("UNAVAILABLE")
    if (gear.weapon.skills.includes(input.skill)) return reject("ALREADY")
    const bag = Bag.remove(state.bag, book, 1)
    if (!bag) return reject("NO_MATERIALS")
    const skills = gear.weapon.skills.map((skill, index) =>
      index === input.slot ? input.skill : skill
    )
    return accept(
      {
        ...state,
        bag,
        gear: state.gear.map((entry) =>
          entry.id === gear.id
            ? { ...entry, weapon: { ...gear.weapon!, skills } }
            : entry
        ),
      },
      { type: "inscribed", gear: gear.id, slot: input.slot, skill: input.skill }
    )
  }
}
