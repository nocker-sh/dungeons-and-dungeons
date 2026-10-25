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
 * 鍛冶屋で防具の耐久を直す。仲間を指定すればその一人、省けば着けている防具すべて。
 * 費用は減った耐久 × `balance.armor.repairPerPoint`（防具ごとに切り上げ）。お金が足りなければ何も変えない。
 */
export class Repair {
  static readonly featureId = "W025"
  constructor(
    private readonly deps: Pick<GameDependencies, "catalog" | "party">
  ) {}

  execute(state: GameState, input: GameActionOf<"repair">): Transition {
    if (!inTown(state)) return reject("WRONG_PHASE")
    if (input.member && !state.members.some((m) => m.id === input.member))
      return reject("UNKNOWN")
    const targets = state.gear.filter((gear) => {
      if (!gear.owner || gear.wear <= 0) return false
      if (input.member && gear.owner !== input.member) return false
      return this.deps.catalog.good(gear.good)?.kind === "armor"
    })
    if (!targets.length) return reject("ALREADY")
    const durability = targets.reduce((sum, gear) => sum + gear.wear, 0)
    const gold = targets.reduce(
      (sum, gear) => sum + this.deps.party.equipment.repairCost(gear.wear),
      0
    )
    if (state.gold < gold) return reject("NO_GOLD")
    const repaired = new Set(targets.map((gear) => gear.id))
    return accept(
      {
        ...state,
        gold: state.gold - gold,
        gear: state.gear.map((gear) =>
          repaired.has(gear.id) ? { ...gear, wear: 0 } : gear
        ),
      },
      { type: "repaired", gears: [...repaired], durability, gold }
    )
  }
}
