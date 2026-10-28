import { z } from "zod"
import { statusKinds, targets, weaponTypes } from "@/lib/wiz/content/constants"
import { positive, id, count } from "./primitives"
import { status } from "./combat"

export const effect = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("heal"),
    hp: positive,
    all: z.boolean().optional(),
  }),
  z.strictObject({ type: z.literal("refill"), uses: positive }),
  z.strictObject({
    type: z.literal("damage"),
    amount: positive,
    all: z.boolean().optional(),
  }),
  z.strictObject({
    type: z.literal("status"),
    status,
    target: z.enum(targets).optional(),
  }),
  z.strictObject({
    type: z.literal("cure"),
    kinds: z.array(z.enum(statusKinds)).min(1),
    all: z.boolean().optional(),
  }),
  z.strictObject({ type: z.literal("revive"), hp: positive }),
])

export const good = z.strictObject({
  id,
  name: z.string().min(1),
  kind: z.enum(["weapon", "armor", "item", "material"]),
  desc: z.string(),
  stat: z.string(),
  price: positive.optional(),
  sell: positive.optional(),
  /** 契約書や一度だけ手に入る約束の品を売って進行不能にしない。 */
  sellable: z.boolean().optional(),
  /**
   * 店に並ぶのに要る到達の深さ（層の番号）。省略で最初から並ぶ。
   * 深く潜るほど強い段の武器・防具が買えるようにするための項目。
   */
  unlock: count.optional(),
  /** 鑑定の候補に加わる到達層。省略した品物は、従来どおり最初から候補になる。 */
  appraiseFrom: count.optional(),
  /** 通常段の鑑定重み。一つ先の段ではaheadを掛ける。 */
  appraisalWeight: z.number().positive().optional(),
  /** 古い段になっても鑑定候補に残す品の重み。省略した装備は従来の段範囲に従う。 */
  appraisalRetentionWeight: z.number().positive().optional(),
  /** 買うと袋ではなく召喚石が増える品物。増える数。 */
  stones: positive.optional(),
  /** 装備の部位。同じ部位は一人一つ。省略で武器は weapon、防具は armor。 */
  slot: id.optional(),
  /** 武器種（武器には必ず付ける）。 */
  weaponType: z.enum(weaponTypes).optional(),
  /** 武器の攻撃力（武器には必ず付ける）。 */
  power: z.number().positive().optional(),
  /** 強化1段で増える攻撃力。省略すると1。固定武器の成長に使う。 */
  powerPerPlus: z.number().positive().optional(),
  /** 装備に必要な筋力・技量（武器には必ず付ける）。足りなくても装備はできる。 */
  need: z.strictObject({ str: count, tec: count }).optional(),
  /** 武器に付くワザ。ちょうど4つ。前の2つはその武器で固定、後ろの2つは個体によってランダムなワザに変わる。 */
  skills: z.array(id).optional(),
  /** 防具の最大の耐久（防具には必ず付ける）。受けた被害はここから先に減る。 */
  durability: positive.optional(),
  /** 装備できる職業。省略なら職業制限なし。ユニークの固有装備は別扱い。 */
  allowedJobs: z.array(id).min(1).optional(),
  bonus: z
    .strictObject({
      str: z.number().int().optional(),
      tec: z.number().int().optional(),
      spd: z.number().int().optional(),
      maxHp: z.number().int().optional(),
    })
    .optional(),
  effect: effect.optional(),
})
