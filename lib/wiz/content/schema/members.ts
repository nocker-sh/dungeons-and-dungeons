import { z } from "zod"
import {
  HERO_NAME_STORED_MAX,
  growthTypes,
  magicSchools,
  roles,
  weaponTypes,
} from "@/lib/wiz/content/constants"
import { id, positive, stats, growth } from "./primitives"

export const member = z.strictObject({
  id,
  name: z.string().min(1),
  job: z.string().min(1),
  role: z.enum(roles),
  exploration: z
    .enum(["scout", "bargain", "trapper", "camp", "hunter"])
    .optional(),
  combatStyle: z.string().min(1).optional(),
  hero: z.boolean().optional(),
  lv: positive,
  stats,
  /** この仲間だけのスキル（回復・補助など）。武器のワザとは別。 */
  skills: z.array(id),
  /**
   * 使える魔法の流派。流派の付いたキャラ固有のスキルは、その流派を使える仲間だけが選べる。
   * 主人公は合体している悪魔の流派を使うので書かない。武器に付くワザは誰でも使える。
   */
  schools: z.array(z.enum(magicSchools)).optional(),
  /** 得意な武器種。得意な武器では攻撃力が上がる。 */
  favorite: z.enum(weaponTypes),
  /** 武器を装備していないときに使う武器。持ち物にはならない。 */
  defaultWeapon: id,
  /** 最初から装備している武器。 */
  weapon: id.optional(),
  /** 最初から装備している防具など。 */
  gear: z.array(id).optional(),
  /** この仲間だけの伸び。省略で balance.growth。 */
  growth: growth.optional(),
  /** 成長の型。省略で normal。 */
  growthType: z.enum(growthTypes).optional(),
  /**
   * 専用の武器を持つ仲間（R・ユニーク）。専用の武器（`weapon`）は付け替えられず、
   * 拾った武器を素材にして鍛冶屋で鍛え直す。防具は `fixedArmor` がなければ着替えられる。
   */
  unique: z.boolean().optional(),
  /** 防具も変えられない（固定装備の仲間）。`unique` と一緒に使う。 */
  fixedArmor: z.boolean().optional(),
  /**
   * 悪魔と契約して戦う仲間（R）。武器も防具も持たず、戦闘中の「ケイヤク」でモードを変える。
   * モードの戦い方（武器種・攻撃力・3つのワザ）は `weapon` の品物で決まり、level に届くと選べるようになる。
   */
  pact: z
    .strictObject({
      modes: z
        .array(
          z.strictObject({
            level: positive,
            weapon: id,
            roles: z.array(z.enum(roles)).min(1).optional(),
            combatStyle: z.string().min(1).optional(),
          })
        )
        .min(1),
    })
    .optional(),
})

/**
 * 主人公。始めるときに名前と外見を決める。
 * `looks` は設定資料の外見の id で、絵と名前は画面側が同じ id から引く。
 */
export const hero = z.strictObject({
  /** 登録前の仮の呼び名。 */
  name: z.string().min(1).max(HERO_NAME_STORED_MAX),
  /** 選べる外見の候補。先頭が最初に選ばれている外見。 */
  looks: z.array(id).min(1),
  /** 衣装は見た目だけ。所持・装備・能力補正には使わない。 */
  outfits: z.array(id).optional(),
})
