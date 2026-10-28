import { z } from "zod"
import { magicSchools, statusKinds } from "@/lib/wiz/content/constants"
import { id, positive, count } from "./primitives"
import { member } from "./members"

export const demon = z.strictObject({
  id,
  name: z.string().min(1),
  /** 旧制作データの読み込み専用。ゲームでは階級と抽選を使わない。 */
  rank: z.enum(["SSR", "SR", "R"]).optional(),
  weight: positive.optional(),
  contract: z
    .strictObject({
      encounter: id,
      paper: id.optional(),
      gold: count,
      stones: count.optional(),
      materials: z.array(z.strictObject({ good: id, count: positive })).min(1),
    })
    .optional(),
  skills: z.array(id).min(1),
  /** この悪魔の魔法の流派。合体している主人公はこの流派を使う。 */
  school: z.enum(magicSchools).optional(),
  /**
   * 合体の効果。悪魔のレベル1つごとに主人公へ足す分。
   * ワザの威力そのものは `summon.powerPerLevel` で上がる（合体の効果とは別）。
   */
  fusion: z
    .strictObject({
      /** レベル1つごとに上がる攻撃力の割合。 */
      attack: z.number().nonnegative().optional(),
      /** レベル1つごとに増える最大HP。 */
      maxHp: count.optional(),
      /** レベル1つごとに増える状態異常への耐性（合計は1まで）。 */
      resist: z
        .partialRecord(z.enum(statusKinds), z.number().min(0).max(1))
        .optional(),
    })
    .optional(),
})

export const room = z.strictObject({
  id,
  name: z.string().min(1),
  price: count,
  heal: z.enum(["half", "full"]),
  fatigue: z.number().int(),
  dirt: z.number().int(),
  levelUp: z.boolean(),
  clean: z.boolean().optional(),
})

export const shop = z.strictObject({
  id,
  goods: z.array(id),
  appraise: z.array(id).optional(),
})

const stack = z.strictObject({ good: id, count: positive })

export const recruit = z.strictObject({
  id,
  /** 新規募集を終了。旧保存の仲間・装備参照は維持する。 */
  retired: z.boolean().optional(),
  price: positive,
  /** 募集の枠に並ぶ出やすさ。省略で1。珍しい者ほど小さくする。 */
  weight: positive.optional(),
  /** 珍しさの表示。 */
  rank: z.enum(["SSR", "SR", "R"]).optional(),
  member,
})

/** 召喚：成功すれば悪魔、失敗すれば燃えカスなどの素材。同じ悪魔は経験値になる。 */
export const summon = z.strictObject({
  /** 成功する確率（0〜1）。 */
  success: z.number().min(0).max(1),
  /** 失敗したときに手に入る物。 */
  failure: z.array(stack).min(1),
  /** 同じ悪魔が出たときの経験値。 */
  duplicateExp: positive,
  /** 1レベル上がるのに要る経験値。 */
  levelExp: positive,
  maxLevel: positive,
  /** 悪魔のレベル1つごとに、主人公のワザの威力に足す割合。 */
  powerPerLevel: z.number().nonnegative(),
})

/** 冒険者の募集：枠の数、枠を引き直す値段、最初に並ぶ募集。 */
export const recruiting = z.strictObject({
  slots: positive,
  reroll: positive,
  initial: z.array(id),
})

/** 鍛冶屋：強化は +1 ごとの費用（配列の長さが上限）、生産はレシピ。 */
export const cost = z.strictObject({ gold: count, materials: z.array(stack) })

export const smithy = z.strictObject({
  skillBook: id.optional(),
  upgrades: z.array(cost),
  recipes: z.array(cost.extend({ id, good: id })),
})

export const quest = z.strictObject({
  id,
  /** 探索なしで戦う依頼。勝利時に自動精算する。`place` は戦う場所の背景の鍵。 */
  encounter: z
    .strictObject({
      place: z.enum([
        "town",
        "farm",
        "highway",
        "rim-road",
        "shop-street",
        "back-alley",
      ]),
      foes: z.array(id).min(1).max(3),
      reached: count,
    })
    .optional(),
  requiresCleared: z.boolean().optional(),
  requiresFullPartyAlive: z.boolean().optional(),
  requiresBossVictory: z.boolean().optional(),
  name: z.string().min(1),
  desc: z.string(),
  foe: id,
  count: positive,
  reward: z.strictObject({
    gold: count,
    goods: z.array(z.strictObject({ good: id, count: positive })),
  }),
})
