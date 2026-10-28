import { z } from "zod"
import {
  magicSchools,
  reaches,
  statusKinds,
  targets,
} from "@/lib/wiz/content/constants"
import { positive, id, count } from "./primitives"

export const status = z.strictObject({
  kind: z.enum(statusKinds),
  turns: positive,
  /** かかる確率（0〜1）。省略で必ず。 */
  chance: z.number().min(0).max(1).optional(),
})

export const skill = z.strictObject({
  id,
  blessing: z.boolean().optional(),
  name: z.string().min(1),
  desc: z.string(),
  /** 最大の使用回数。省略で無制限（敵のワザと「殴る」）。 */
  uses: positive.optional(),
  /** hit：被害、heal：回復、support：被害も回復もなく状態だけ。 */
  kind: z.enum(["hit", "heal", "support"]),
  /** 攻撃の届き方。hit のワザには必ず付ける。後衛から近接は被害が減る。 */
  reach: z.enum(reaches).optional(),
  power: z.number().positive().optional(),
  target: z.enum(targets).optional(),
  status: status.optional(),
  cure: z.array(z.enum(statusKinds)).optional(),
  revive: z.boolean().optional(),
  /** 味方の防具の耐久を戻す量（キャラ固有のスキル）。 */
  repair: positive.optional(),
  /** 魔法の流派。省略すると流派を持たないワザ（誰でも使える）。 */
  school: z.enum(magicSchools).optional(),
  /**
   * 自分を削って放つワザ（悪魔の流派）。払う最大HPの割合。
   * 今のHPがこれを上回っていないと選べず、払った分は防具を通さずHPから減る。
   */
  sacrifice: z.number().positive().max(0.9).optional(),
  drain: z.number().positive().max(1).optional(),
  bonusAgainst: z
    .strictObject({
      status: z.enum(statusKinds),
      factor: z.number().min(1).max(3),
    })
    .optional(),
})

export const foe = z.strictObject({
  id,
  /** 通常攻撃の呼び名と届き方。省略した従来データは近接の「攻撃」。 */
  attack: z
    .strictObject({ name: z.string().min(1), reach: z.enum(reaches) })
    .optional(),
  /** 同じ効果のワザでも、本人の部位に合わせて呼び名を変える。 */
  skillNames: z.record(id, z.string().min(1)).optional(),
  name: z.string().min(1),
  hp: positive,
  atk: count,
  spd: count,
  exp: count,
  gold: z.tuple([count, count]),
  drops: z.array(z.strictObject({ good: id, count: positive })),
  /** 倒すと手に入る召喚石。中ボス・ボスに付ける。 */
  stones: count.optional(),
  /** 使うワザ。手番ごとに skillRate の確率で、使えるワザから一つ選ぶ。 */
  skills: z.array(id).optional(),
  skillRate: z.number().min(0).max(1).optional(),
  /** 状態異常への耐性（0〜1）。かかる確率に (1 − 耐性) を掛ける。 */
  resist: z
    .partialRecord(z.enum(statusKinds), z.number().min(0).max(1))
    .optional(),
})
