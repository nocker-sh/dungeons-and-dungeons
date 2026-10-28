import type { GameCatalog } from "@/lib/wiz/content/game-catalog"
import type { BattleRules } from "@/lib/wiz/rules/battle-rules"
import type { ExpeditionRules } from "@/lib/wiz/rules/expedition-rules"
import type { PartyRules } from "@/lib/wiz/rules/party-rules"
import type { WeaponRules } from "@/lib/wiz/rules/weapon-rules"

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
