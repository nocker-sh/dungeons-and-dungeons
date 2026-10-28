import type { GameActionOf } from "@/lib/wiz/commands"
import type { GameState } from "@/lib/wiz/state/state-schema"
import type { GameDependencies } from "@/lib/wiz/application/game-dependencies"
import { DemonContractRules } from "@/lib/wiz/rules/demon-contract-rules"
import { accept } from "@/lib/wiz/application/accept"
import { reject } from "@/lib/wiz/application/reject"

/** 出会いの物語を見た相手へ、素材と契約料を一度だけ払う。 */
export class ContractDemon {
  static readonly featureId = "W040"
  constructor(private readonly deps: Pick<GameDependencies, "catalog">) {}
  execute(state: GameState, input: GameActionOf<"contract-demon">) {
    const payment = new DemonContractRules(this.deps.catalog).prepare(
      state,
      input.demon
    )
    if (!payment.ready) return reject(payment.reason)
    const { demon, contract, bag } = payment
    return accept(
      {
        ...state,
        bag,
        gold: state.gold - contract.gold,
        stones: state.stones - (contract.stones ?? 0),
        demons: [...state.demons, { id: demon.id, lv: 1, exp: 0 }],
        contract: state.contract ?? demon.id,
      },
      { type: "demon-contracted", demon: demon.id }
    )
  }
}
