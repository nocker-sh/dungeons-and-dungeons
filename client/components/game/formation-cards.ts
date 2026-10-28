/** 位置を測る道具（Fx の center だけを使う）。 */
export type CenterMeasure = {
  center: (
    element: Element | null,
    fy?: number
  ) => { x: number; y: number; w: number; h: number }
}

/**
 * 下の仲間の札を並び順で預かる。
 * 数字やエフェクトを札の上へ出す側は、DOMの探し方を知らずに位置を測れる。
 */
export class FormationCards {
  private readonly elements = new Map<number, HTMLElement>()

  /** 札を預ける（ref に渡す）。 */
  register(index: number, element: HTMLElement | null) {
    if (element) this.elements.set(index, element)
    else this.elements.delete(index)
  }

  /** 並びの index の札。 */
  card(index: number) {
    return this.elements.get(index) ?? null
  }

  /** 並び順の札（左から順）。 */
  all() {
    return [...this.elements.entries()]
      .sort(([left], [right]) => left - right)
      .map(([, element]) => element)
  }

  /** 仲間の札の中心（view 基準）。数字やエフェクトを札の上に出すのに使う。 */
  center(measure: CenterMeasure, party: readonly string[], id: string) {
    return measure.center(this.card(party.indexOf(id)), 0.35)
  }
}
