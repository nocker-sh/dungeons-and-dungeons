import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { GameReason } from "@/lib/wiz/state/game-reason"
import type { GameState, Stack } from "@/lib/wiz/state/state-schema"
import { Bag } from "@/lib/wiz/rules/bag"

type Demon = NonNullable<ReturnType<GameCatalog["demon"]>>

type ContractPayment =
  | Readonly<{
      ready: true
      demon: Demon
      contract: NonNullable<Demon["contract"]>
      bag: readonly Stack[]
    }>
  | Readonly<{ ready: false; reason: GameReason }>

/** 悪魔と契約できる条件と支払い。表示と実行で同じ判定を使う。 */
export class DemonContractRules {
  constructor(private readonly catalog: GameCatalog) {}

  prepare(state: GameState, demonId: string): ContractPayment {
    if (state.phase.type !== "town")
      return { ready: false, reason: "WRONG_PHASE" }
    if (
      state.conversation?.active ||
      state.wipe ||
      state.hero.registrationPending
    )
      return { ready: false, reason: "NOT_READY" }
    const demon = this.catalog.demon(demonId)
    if (!demon?.contract) return { ready: false, reason: "UNKNOWN" }
    if (state.demons.some((owned) => owned.id === demon.id))
      return { ready: false, reason: "ALREADY" }
    const contract = demon.contract
    if (!state.conversation?.seen.includes(contract.encounter))
      return { ready: false, reason: "NOT_READY" }
    if (state.gold < contract.gold) return { ready: false, reason: "NO_GOLD" }
    if (state.stones < (contract.stones ?? 0))
      return { ready: false, reason: "NO_MATERIALS" }
    const bag = Bag.pay(state.bag, contract.materials)
    if (!bag) return { ready: false, reason: "NO_MATERIALS" }
    return { ready: true, demon, contract, bag }
  }
}
