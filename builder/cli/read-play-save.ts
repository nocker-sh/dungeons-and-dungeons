import { z } from "zod"

const randomState = z.number().int().min(0).max(0xffffffff)
const envelope = z.object({
  seed: z.number().int().optional(),
  rng: randomState.optional(),
  serial: z.number().int().nonnegative().optional(),
  policyRng: randomState.optional(),
  save: z.unknown(),
})

/** Validate CLI continuation metadata; the game's own codec validates its save payload. */
export function readPlaySave(text: string) {
  const result = envelope.safeParse(JSON.parse(text) as unknown)
  if (!result.success) {
    const message = result.error.issues.some(
      (issue) => issue.path[0] === "policyRng"
    )
      ? "自動方策の乱数記録を読み込めません"
      : "保存の再開情報を読み込めません"
    throw new Error(message, { cause: result.error })
  }
  return result.data
}
