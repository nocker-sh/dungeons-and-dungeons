import type {
  GameCatalog,
  GrowthType,
  MagicSchool,
  StatusKind,
  WeaponType,
} from "@/lib/wiz/content"
import type { GameState } from "@/lib/wiz/state"

/** 主人公は名付けた名前、ほかの仲間は定義の名前。 */
export function memberName(
  catalog: GameCatalog,
  state: Pick<GameState, "hero">,
  id: string
) {
  const member = catalog.member(id)
  return member?.hero ? state.hero.name : (member?.name ?? id)
}

/** 状態異常と強化の日本語。 */
export const STATUS_NAMES = {
  poison: "毒",
  bind: "縛り",
  charge: "溜め",
  protect: "守り",
  regen: "再生",
  taunt: "挑発",
} as const
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

/** 状態異常耐性の表示。丸めた割合だけで完全無効と判断しない。 */
export function statusResistanceView(kind: StatusKind, value: number) {
  const name = STATUS_NAMES[kind]
  const percent = Math.round(value * 100)
  const immune = value === 1
  return {
    kind,
    name,
    percent,
    immune,
    label: immune
      ? `${name}無効`
      : percent === 100
        ? `${name}100%未満`
        : `${name}${percent}%`,
  }
}
