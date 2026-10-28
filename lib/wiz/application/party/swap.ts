import type { GameActionOf } from "@/lib/wiz/commands"
import type { GameState } from "@/lib/wiz/state/state-schema"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { inTown } from "@/lib/wiz/application/in-town"
import { accept } from "@/lib/wiz/application/accept"
import { reject } from "@/lib/wiz/application/reject"
import type { Transition } from "@/lib/wiz/application/transition"

/** 出撃メンバーと控えを入れ替える。入る仲間は出る仲間の位置（前衛・後衛）に入る。主人公は外せない。 */
export class Swap {
  static readonly featureId = "W019"
  constructor(private readonly deps: Pick<GameDependencies, "party">) {}

  execute(state: GameState, input: GameActionOf<"swap">): Transition {
    if (!inTown(state)) return reject("WRONG_PHASE")
    const out = state.members.find((member) => member.id === input.out)
    const incoming = state.members.find((member) => member.id === input.in)
    if (
      !out ||
      !incoming ||
      !state.party.includes(out.id) ||
      state.party.includes(incoming.id)
    )
      return reject("UNKNOWN")
    if (this.deps.party.equipment.isHero(out)) return reject("HERO")
    return accept(
      {
        ...state,
        party: state.party.map((id) => (id === out.id ? incoming.id : id)),
      },
      { type: "swapped", out: out.id, in: incoming.id }
    )
  }
}
