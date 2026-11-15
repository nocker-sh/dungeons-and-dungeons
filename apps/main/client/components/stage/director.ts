/**
 * 場面の上で、今なにが画面を占めているかの有限オートマトン。
 * 画面を占めるもの（Takeover）は入ると enter で登録し、出ると戻り値を呼ぶ。
 * 場面のUI・共通UI（設定・戻る）・隊列の見せ方は、登録されているものの組から表（TAKEOVER_RULES）で一通りに決まる。
 * 部品は隊列や共通UIを直に隠さない。隠したいときは、何が画面を占めているかを登録する。
 */

/** 画面を占めるもの。 */
export type Takeover =
  /** 下の札を引っ込めて見せる板（バッグ）。 */
  | "bag"
  /** 主人公の容姿を選んでいる（隊列はまだない）。 */
  | "appearance"
  /** 場面の中の一覧・部屋（募集・秘密の部屋）。戻るは引っ込める。 */
  | "list"
  /** 仲間の詳細。隊列で仲間を切り替えられるが、場面の戻るは引っ込める。 */
  | "stand"
  /** 仲間や住人との会話。隊列を下げ、戻るは引っ込める。 */
  | "conversation"
  /** それだけを見せる場面（名前の記入など）。背景とその中身のほかは出さない。 */
  | "solo"

/** 場面のUI（人物・吹き出し・店の札）。 */
export type SceneShow = "shown" | "hidden"
/** 共通UI（設定・戻る）。leaving は退場の動きで引っ込める。 */
export type ChromeShow = "shown" | "leaving" | "hidden"
/**
 * 下の隊列。lowered は高さを保ったまま下へ下げる。folded は高さを0に畳んで札を引っ込める（バッグのボタンは残す）。
 * gone は高さを0にして何も見せない。
 */
export type FormationShow = "shown" | "lowered" | "folded" | "gone"

export type StageView = Readonly<{
  scene: SceneShow
  chrome: ChromeShow
  formation: FormationShow
  /** 今画面を占めているもの（重複なし・入った順）。 */
  takeovers: readonly Takeover[]
}>

type Surfaces = Omit<StageView, "takeovers">

/** 画面を占めるものごとの見せ方。 */
export const TAKEOVER_RULES: Readonly<Record<Takeover, Surfaces>> = {
  bag: { scene: "shown", chrome: "shown", formation: "folded" },
  appearance: { scene: "shown", chrome: "shown", formation: "gone" },
  list: { scene: "shown", chrome: "leaving", formation: "shown" },
  stand: { scene: "shown", chrome: "leaving", formation: "shown" },
  conversation: { scene: "shown", chrome: "leaving", formation: "lowered" },
  solo: { scene: "hidden", chrome: "hidden", formation: "gone" },
}

/** 何も占めていないとき。 */
const FREE: Surfaces = { scene: "shown", chrome: "shown", formation: "shown" }

/** 強さの順（後ろほど強い）。重なったときは面ごとに一番強い見せ方を採る。 */
const STRENGTH = {
  scene: ["shown", "hidden"],
  chrome: ["shown", "leaving", "hidden"],
  formation: ["shown", "lowered", "folded", "gone"],
} as const satisfies { [K in keyof Surfaces]: readonly Surfaces[K][] }

function stronger<K extends keyof Surfaces>(
  surface: K,
  a: Surfaces[K],
  b: Surfaces[K]
): Surfaces[K] {
  const order: readonly string[] = STRENGTH[surface]
  return order.indexOf(b) > order.indexOf(a) ? b : a
}

/** 画面を占めているものの組から見せ方を決める。順番と重複には左右されない。 */
export function stageViewOf(takeovers: readonly Takeover[]): StageView {
  const unique = [...new Set(takeovers)]
  const surfaces = unique.reduce<Surfaces>((view, takeover) => {
    const rule = TAKEOVER_RULES[takeover]
    return {
      scene: stronger("scene", view.scene, rule.scene),
      chrome: stronger("chrome", view.chrome, rule.chrome),
      formation: stronger("formation", view.formation, rule.formation),
    }
  }, FREE)
  return { ...surfaces, takeovers: unique }
}

export class StageDirector {
  private entries: { id: number; takeover: Takeover }[] = []
  private nextId = 0
  private view: StageView = stageViewOf([])
  private listeners = new Set<() => void>()

  /** 画面を占めるものを登録する。戻り値を呼ぶと外す（二度呼んでも一度だけ外す）。同じものを重ねて登録できる。 */
  enter(takeover: Takeover): () => void {
    const id = this.nextId++
    this.entries = [...this.entries, { id, takeover }]
    this.update()
    return () => {
      const before = this.entries.length
      this.entries = this.entries.filter((entry) => entry.id !== id)
      if (this.entries.length !== before) this.update()
    }
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => void this.listeners.delete(listener)
  }

  /** 今の見せ方。変わらない間は同じ値を返す（useSyncExternalStore 用）。 */
  readonly snapshot = (): StageView => this.view

  private update() {
    const next = stageViewOf(this.entries.map((entry) => entry.takeover))
    if (sameView(next, this.view)) return
    this.view = next
    for (const listener of this.listeners) listener()
  }
}

function sameView(a: StageView, b: StageView) {
  return (
    a.scene === b.scene &&
    a.chrome === b.chrome &&
    a.formation === b.formation &&
    a.takeovers.length === b.takeovers.length &&
    a.takeovers.every((takeover, index) => takeover === b.takeovers[index])
  )
}
