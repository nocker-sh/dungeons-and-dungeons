import type { GameActionOf } from "@/lib/wiz/commands"
import type { GameState } from "@/lib/wiz/state"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { inTown } from "@/lib/wiz/application/in-town"
import { Bag } from "@/lib/wiz/rules/bag"
import { accept, reject } from "@/lib/wiz/application/transition"

/** 出会いの物語を見た相手へ、素材と契約料を一度だけ払う。 */
export class ContractDemon {
  static readonly featureId = "W040"
  constructor(private readonly deps: Pick<GameDependencies, "catalog">) {}
  execute(state: GameState, input: GameActionOf<"contract-demon">) {
    if (!inTown(state)) return reject("WRONG_PHASE")
    if (
      state.conversation?.active ||
      state.wipe ||
      state.hero.registrationPending
    )
      return reject("NOT_READY")
    const demon = this.deps.catalog.demon(input.demon)
    if (!demon?.contract) return reject("UNKNOWN")
    if (state.demons.some((owned) => owned.id === demon.id))
      return reject("ALREADY")
    if (!state.conversation?.seen.includes(demon.contract.encounter))
      return reject("NOT_READY")
    if (state.gold < demon.contract.gold) return reject("NO_GOLD")
    if (state.stones < (demon.contract.stones ?? 0))
      return reject("NO_MATERIALS")
    const bag = Bag.pay(state.bag, demon.contract.materials)
    if (!bag) return reject("NO_MATERIALS")
    return accept(
      {
        ...state,
        bag,
        gold: state.gold - demon.contract.gold,
        stones: state.stones - (demon.contract.stones ?? 0),
        demons: [...state.demons, { id: demon.id, lv: 1, exp: 0 }],
        contract: state.contract ?? demon.id,
      },
      { type: "demon-contracted", demon: demon.id }
    )
  }
}
