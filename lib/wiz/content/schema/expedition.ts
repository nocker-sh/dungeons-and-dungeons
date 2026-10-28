import { z } from "zod"
import { eventKinds } from "@/lib/wiz/content/constants"
import { id, count, positive } from "./primitives"

const discovery = z.strictObject({
  title: z.string().min(1),
  description: z.string().min(1),
  choices: z
    .array(
      z.strictObject({
        id,
        label: z.string().min(1),
        description: z.string().min(1),
        blessings: z.array(id).min(1).optional(),
        healRatio: z.number().min(0).max(1).optional(),
        fatigue: count.optional(),
        refill: count.optional(),
        cost: count.optional(),
        costGoods: z
          .array(z.strictObject({ good: id, count: positive }))
          .optional(),
        healthCostRatio: z.number().positive().max(0.9).optional(),
        damageRatio: z.number().min(0).max(0.9).optional(),
        goods: z
          .array(z.strictObject({ good: id, count: positive }))
          .optional(),
      })
    )
    .min(2)
    .max(3),
})

const station = z.strictObject({
  id,
  x: z.number().int(),
  y: z.number().int(),
  next: z.array(id),
  boss: z.boolean().optional(),
  event: z.enum(eventKinds).optional(),
  label: z.string().min(1).optional(),
  hint: z.string().min(1).optional(),
  danger: z.enum(["low", "medium", "high", "unknown"]).optional(),
  mystery: z.boolean().optional(),
  weights: z
    .strictObject({
      battle: count,
      treasure: count,
      trap: count,
      discovery: count,
    })
    .optional(),
  discovery: discovery.optional(),
  rewardGoods: z
    .array(z.strictObject({ good: id, count: positive }))
    .optional(),
  /** この地点で必ず出る敵（中ボスなど）。省略で層の敵から選ぶ。 */
  foes: z.array(id).min(1).optional(),
})

export const layer = z.strictObject({
  id,
  no: count,
  name: z.string().min(1),
  foes: z.array(id).min(1),
  /** 一度の戦闘に出る敵の数。省略で1。 */
  group: z.tuple([positive, positive]).optional(),
  boss: id,
  start: id,
  stations: z.array(station).min(2),
  weights: z.strictObject({ battle: count, treasure: count, trap: count }),
  treasure: z.strictObject({
    gold: z.tuple([count, count]),
    goods: z.array(z.strictObject({ good: id, count: positive })),
    mimic: z
      .strictObject({ foe: id, chance: z.number().min(0).max(1) })
      .optional(),
  }),
  trap: z.tuple([count, count]),
  /**
   * 地点ごとに見せる背景の候補（作品側の絵の識別子）。path は道中、treasure は宝箱、
   * rest は休める発見。省略した種類は path を使う。選び方はエンジンの LayerScenes。
   */
  scenes: z
    .strictObject({
      path: z.array(id).min(1),
      treasure: z.array(id).min(1).optional(),
      rest: z.array(id).min(1).optional(),
    })
    .optional(),
})
