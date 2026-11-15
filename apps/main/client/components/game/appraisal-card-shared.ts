export type AppraisalFind = {
  key: string
  /** 武器・防具の個体 id（道具は null）。 */
  gear: string | null
  /** 品物の id（一覧の絵）。 */
  good: string
  name: string
  rarity: string | null
  stat: string
  /** 防具・道具の特徴と装備条件。 */
  desc: string
  skills: readonly { name: string; uses: number | null; random: boolean }[]
  /** 到達した層より一つ先の段の品。 */
  bargain: boolean
  /** 武器か（武器だけ、持つと強くなる仲間を添える）。 */
  weapon: boolean
  /** いちばん攻撃力が上がる仲間。誰も上がらなければ null。 */
  upgrade: { name: string; before: number; after: number } | null
}
