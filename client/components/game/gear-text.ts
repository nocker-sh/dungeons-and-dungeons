export const NO_ATTACK_UPGRADE_MESSAGE =
  "今の編成では攻撃力が上がる仲間はいません"

/** 武器と防具の説明文。値はエンジンのQueryから受け取り、並べ方だけを決める。 */

export type WeaponInfo = {
  typeName: string
  power: number
  /** 個体のレア度（N・R・SR）。 */
  rarity: string
  /** 固定値より上振れしている攻撃力。 */
  extraPower: number
  need: { readonly str: number; readonly tec: number }
  skills: readonly {
    name: string
    desc?: string
    uses: number | null
    random: boolean
  }[]
}

export type ArmorState = {
  attack?: number
  hp: number
  maxHp: number
  str: number
  tec: number
  spd: number
  durability: number
  maxDurability: number
}
