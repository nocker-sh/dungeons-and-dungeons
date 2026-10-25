/** 自動プレイ方針の公開API。処理は場面・目的ごとのモジュールへ置く。 */
export { battleAction, type BattleStyle } from "./battle"
export {
  expeditionAction,
  DEFAULT_PLAN,
  PUSH_PLAN,
  type ExpeditionPlan,
} from "./expedition"
export { fillParty, startParty, hireRecruits } from "./party"
export { townDay, type TownDayResult } from "./town"
export { healItemFor } from "./healing"
export {
  appraiseJunk,
  reforgeUnique,
  equipBestWeapon,
  equipBestArmor,
  buyGear,
} from "./equipment"
