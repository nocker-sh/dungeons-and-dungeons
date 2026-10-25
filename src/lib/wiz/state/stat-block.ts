/** 素の能力のかたまり。装備の補正を足した値にも使う。 */
export type StatBlock = Readonly<{
  maxHp: number
  str: number
  tec: number
  spd: number
}>
