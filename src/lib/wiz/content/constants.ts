/**
 * 作品のデータで使う決まった値（種類の一覧）と、そこから決まる型。
 * 中身は src/lib/content が持ち、エンジンは受け取ったものだけを使う。
 */
export const rows = ["front", "back"] as const
export const roles = ["summoner", "tank", "damage", "healer"] as const
/** 地点の出来事。midboss は層の途中の決まった強敵（倒しても層は終わらない）。 */
export const eventKinds = [
  "battle",
  "treasure",
  "discovery",
  "trap",
  "midboss",
  "boss",
] as const
/**
 * 状態異常と強化。poison：行動のたびに最大HPの一部を失う。bind：手番を飛ばす。
 * charge：次の一撃が倍。protect：次の被害を防ぐ。regen：行動のたびに最大HPの一部を戻す。
 */
export const statusKinds = [
  "poison",
  "bind",
  "charge",
  "protect",
  "regen",
  "taunt",
] as const
/**
 * 魔法の流派（信仰の分かれ方）。仲間は使える流派を持ち、主人公は合体する悪魔の流派を使う。
 * demon：呪い・状態異常、自分を削る強い一撃。star：遠距離・敵全体。
 * earth：守り・防具の耐久。sun：回復・浄化・蘇生。plant：毒・少しずつの回復。
 */
export const magicSchools = ["demon", "star", "earth", "sun", "plant"] as const
/** 効果の対象。foe：敵ひとり、foes：敵全員、ally：味方ひとり、allies：味方全員、self：自分。 */
export const targets = ["foe", "foes", "ally", "allies", "self"] as const
/** 攻撃の届き方。melee：近接、ranged：遠距離。 */
export const reaches = ["melee", "ranged"] as const
/** 武器種。両手剣・片手剣・斧は筋力系、魔法銃・短剣は技量系。 */
export const weaponTypes = [
  "greatsword",
  "sword",
  "axe",
  "gun",
  "dagger",
] as const
/** 筋力系の武器種。ここにないものは技量系。 */
export const strengthWeaponTypes = ["greatsword", "sword", "axe"] as const
/** 武器の個体のレア度。N が基本で、R・SR は攻撃力が上振れし、ランダムなワザが付く。 */
export const rarities = ["N", "R", "SR"] as const
/**
 * 成長の型。レベルの段（序盤・中盤・終盤）ごとに伸びの倍率が変わる。
 * normal：平均。early：早熟（序盤に強く、中盤で追い越され、終盤は同等）。
 * late：晩成（序盤は控えめ、終盤に伸びる）。steady：序盤から中盤まで安定して少し強い。
 * modest：加入時から強い代わりに伸びが控えめ（ユニーク）。
 */
export const growthTypes = [
  "normal",
  "early",
  "late",
  "steady",
  "modest",
] as const
/** 主人公の名前の文字数の上限。ギルドで登録する名前と、後から変える名前の両方に効く。 */
export const HERO_NAME_MAX = 6
/** 保存できる名前の文字数の上限。以前は8文字まで登録できたので、古い保存の名前も読み込める。 */
export const HERO_NAME_STORED_MAX = 8
/** ギルドで名前を登録したときにエンジンが立てる会話のフラグ。登録直後の場面の条件に使う。 */
export const HERO_REGISTERED_FLAG = "hero:registered"
/** 出撃できる人数。前衛2・後衛1。狭い場所で連携できるのは3人まで。 */
export const PARTY_SLOTS = 3
/** 保存できる出撃の人数の上限。以前は4人で出撃していたので、古い保存も読み込める。 */
export const PARTY_STORED_MAX = 4
/** 武器に付く3つのワザのうち、武器で固定される先頭の枠数。 */
export const FIXED_WEAPON_SKILLS = 1
/** 武器に付くワザの数。 */
export const WEAPON_SKILLS = 3

export type EventKind = (typeof eventKinds)[number]
export type StatusKind = (typeof statusKinds)[number]
export type MagicSchool = (typeof magicSchools)[number]
export type Target = (typeof targets)[number]
export type Row = (typeof rows)[number]
export type Reach = (typeof reaches)[number]
export type WeaponType = (typeof weaponTypes)[number]
export type Rarity = (typeof rarities)[number]
export type GrowthType = (typeof growthTypes)[number]
export type Role = (typeof roles)[number]
