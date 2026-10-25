import type { GameCatalog } from "@/lib/wiz/content"
import type {
  BattleRules,
  ExpeditionRules,
  PartyRules,
  WeaponRules,
} from "@/lib/wiz/rules"

/**
 * ユースケースが使うデータと計算規則。合成ルート（definition）が一度だけ組み立てる。
 * 各ユースケースは `Pick` で自分が使う分だけを受け取る。
 */
export type GameDependencies = Readonly<{
  catalog: GameCatalog
  party: PartyRules
  /** 武器の個体差（レア度・上振れ・ランダムなワザ）。 */
  weapons: WeaponRules
  battle: BattleRules
  expedition: ExpeditionRules
}>
