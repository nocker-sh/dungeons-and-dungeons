import type { GameActionOf } from "@/lib/wiz/commands"
import { slotOf } from "@/lib/wiz/content/slot-of"
import type { GameState } from "@/lib/wiz/state/state-schema"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { inTown } from "@/lib/wiz/application/in-town"
import { accept } from "@/lib/wiz/application/accept"
import { reject } from "@/lib/wiz/application/reject"
import type { Transition } from "@/lib/wiz/application/transition"
import { clampHp } from "@/lib/wiz/application/party/clamp-hp"

/**
 * 武器・防具を仲間に着ける。同じ部位の装備は外れる。ほかの仲間が着けていれば付け替える。
 * 悪魔と契約して戦う仲間（R）は何も着けない。専用の武器を持つ仲間（ユニーク）は防具だけ着替えられる。
 */
export class Equip {
  static readonly featureId = "W017"
  constructor(
    private readonly deps: Pick<GameDependencies, "catalog" | "party">
  ) {}

  execute(state: GameState, input: GameActionOf<"equip">): Transition {
    if (!inTown(state)) return reject("WRONG_PHASE")
    const gear = state.gear.find((entry) => entry.id === input.gear)
    const good = gear ? this.deps.catalog.good(gear.good) : undefined
    if (!gear || !good) return reject("NOT_OWNED")
    if (gear.unidentified) return reject("UNAVAILABLE")
    if (!state.members.some((member) => member.id === input.member))
      return reject("UNKNOWN")
    if (gear.owner === input.member) return reject("ALREADY")
    // 悪魔と契約して戦う仲間（R）は武器も防具も持たない。専用の武器を持つ仲間（ユニーク）は武器を付け替えられず、固定装備の仲間は防具も。
    // 専用の武器・固定装備はほかの仲間へ移せない
    if (this.deps.party.equipment.isSlotFixed({ id: input.member }, good.kind))
      return reject("FIXED_GEAR")
    if (this.deps.party.equipment.isFixedGear(gear)) return reject("FIXED_GEAR")
    if (!this.deps.catalog.canEquip(input.member, good.id))
      return reject("WRONG_JOB")
    const slot = slotOf(good)
    const replaced =
      state.gear.find((entry) => {
        if (entry.owner !== input.member || entry.id === gear.id) return false
        const other = this.deps.catalog.good(entry.good)
        return other ? slotOf(other) === slot : false
      }) ?? null
    const next: GameState = {
      ...state,
      gear: state.gear.map((entry) =>
        entry.id === gear.id
          ? { ...entry, owner: input.member }
          : entry.id === replaced?.id
            ? { ...entry, owner: null }
            : entry
      ),
    }
    return accept(clampHp(next, this.deps.party), {
      type: "equipped",
      gear: gear.id,
      member: input.member,
      replaced: replaced?.id ?? null,
    })
  }
}
