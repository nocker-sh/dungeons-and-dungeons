import type { FormationCards } from "@/components/game/formation-cards"
import type { Fx } from "@/components/stage/use-fx"

/**
 * 画面にある戦闘の部品（敵の枠）を預かり、位置を返す。
 * 演出はここから要素と座標を受け取るだけで、DOMの探し方を知らない。
 */
export class BattleParts {
  private readonly foeElements = new Map<string, HTMLDivElement>()

  constructor(
    private readonly fx: Fx,
    private readonly cards: FormationCards
  ) {}

  /** 敵の枠を預ける（ref に渡す）。 */
  foeRef(id: string) {
    return (element: HTMLDivElement | null) => {
      if (element) this.foeElements.set(id, element)
      else this.foeElements.delete(id)
    }
  }

  foe(id: string) {
    return this.foeElements.get(id) ?? null
  }

  /** 並んでいる順の敵の枠（落ちてくる順に使う）。 */
  allFoes() {
    return [...this.foeElements.values()]
  }

  /** 敵の中心。 */
  foeCenter(id: string) {
    return this.fx.center(this.foe(id), 0.45)
  }

  /** カードの中心（隊列の中）。 */
  memberCenter(party: readonly string[], id: string) {
    return this.cards.center(this.fx, party, id)
  }
}
