import type {
  GrowthType,
  MagicSchool,
  WeaponType,
} from "@/lib/wiz/content/constants"

/** 魔法の流派の日本語。 */
export const MAGIC_SCHOOL_NAMES: Record<MagicSchool, string> = {
  demon: "悪魔",
  star: "星",
  earth: "大地",
  sun: "太陽",
  plant: "植物",
}

/** 装備の部位の日本語。 */
export const SLOT_NAMES: Record<string, string> = {
  weapon: "武器",
  armor: "防具",
}

/** 武器種の日本語。 */
export const WEAPON_TYPE_NAMES: Record<WeaponType, string> = {
  greatsword: "両手剣",
  sword: "片手剣",
  axe: "斧",
  gun: "魔法銃",
  dagger: "短剣",
}

/** 成長の型の日本語。 */
export const GROWTH_TYPE_NAMES: Record<GrowthType, string> = {
  normal: "普通",
  early: "早熟",
  late: "晩成",
  steady: "安定",
  modest: "控えめ",
}

/** 能力の日本語。 */
export const STAT_NAMES = {
  str: "筋力",
  tec: "技量",
  spd: "速さ",
  maxHp: "HP",
} as const

/** 編成で選ぶ役割。守り・火力・回復を初回募集で揃える。 */
export const ROLE_NAMES = {
  summoner: "召喚・支援",
  tank: "守り役",
  damage: "攻撃役",
  healer: "回復役",
} as const

export const ROLE_NOTES = {
  summoner: "悪魔との合体で攻撃・支援を切り替える。近接なら前衛へ。",
  tank: "前衛で狙われやすく、守りのワザで味方の消耗を抑える。",
  damage: "敵を倒す役。魔法銃と遠距離ワザは後衛でも威力が落ちない。",
  healer: "後衛から回復・浄化・蘇生を担当。薬を節約して長く潜れる。",
} as const
