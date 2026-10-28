import { z } from "zod"

/**
 * 作品のデータ（仲間・層・敵・品物・悪魔…）の形。
 * 中身は content が持ち、エンジンは受け取ったものだけを使う。
 * 後から足した項目はすべて省略できる。
 */
export const id = z.string().min(1)

export const count = z.number().int().nonnegative()

export const positive = z.number().int().positive()

/** 素の能力。str：筋力、tec：技量。攻撃力は武器が持つ。 */
export const stats = z.strictObject({
  maxHp: positive,
  str: count,
  tec: count,
  spd: count,
})

/** レベルが1上がるときの伸び。spd は伸びる確率（0〜1）。 */
export const growth = z.strictObject({
  maxHp: count,
  str: count,
  tec: count,
  spd: z.number().min(0).max(1),
})

/** 成長の型ごとの、段ごとの伸びの倍率。 */
export const growthWeights = z.strictObject({
  early: z.number().nonnegative(),
  middle: z.number().nonnegative(),
  late: z.number().nonnegative(),
})
