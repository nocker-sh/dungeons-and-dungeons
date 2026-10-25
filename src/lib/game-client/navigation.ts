/** ギルドのホール・その中の受付と宿・商店街。 */
export type Place = "guild" | "reception" | "inn" | "shop"
/** 商店街の店の id（looks.json の shops のキー）。 */
export type ShopId = string

/** ゲーム内の画面。URLは使わず、この値で切り替える。 */
export type Screen =
  /** はじめから遊ぶとき：街へ出る前の夜明けの場面。 */
  | { name: "create" }
  /** はじめから遊ぶとき：最初の仕事からギルドの登録・初出撃まで、自動で進める。 */
  | { name: "prologue" }
  | { name: "town"; intro?: boolean }
  | { name: "outskirts" }
  | { name: "quests" }
  | { name: "world-map" }
  | { name: "place"; place: Place }
  | { name: "shop"; shop: ShopId }
  | { name: "room"; room: string }
  | { name: "expedition"; descent?: () => void; land?: boolean }
