export type Row = {
  key: string
  icon: string
  image?: string
  name: string
  stat?: string
  /** 重い比較は、選んだ品の詳細を表示するときだけ作る。 */
  desc?: string | (() => string)
  owner?: string
  /** 行の右に出す数や値段。 */
  badge?: string
  /** 所持数など、名前の後ろの小さな字。 */
  sub?: string
  /** 武器の個体のレア度（N・R・SR）。武器以外は付けない。 */
  rarity?: string | null
}

export type Tab = { name: string; rows: readonly Row[] }

export type At = { x: number; y: number; w: number; h: number }
