export type LootItem = {
  key: string
  icon: string
  name: string
  n: string
  desc: string
  /** 当たりの品（光るガラクタなど）。金色の縁と光で出す。 */
  rare?: boolean
}
