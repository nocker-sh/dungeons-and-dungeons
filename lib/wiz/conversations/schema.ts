import { z } from "zod"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"

/**
 * 会話が始まる場面。
 * - talk: 街の住人に話しかけたとき。最初の話者が話しかけた相手。
 * - visit: 街の場所に入ったとき。place が入った場所。
 * - opening: はじめから遊ぶとき、街へ着く前の場面。
 */
export const conversationTriggers = [
  "inn",
  "chest",
  "branch",
  "item",
  "talk",
  "visit",
  "opening",
] as const
const flag = z.string().min(1)
const lineSchema = z.strictObject({
  speaker: z.string().min(1),
  text: z.string().min(1),
  expression: z.enum([
    "normal",
    "talk",
    "happy",
    "sigh",
    "angry",
    "surprised",
    "surprisedLarge",
    "thinking",
    "shy",
    "special",
  ]),
})
export const conversationSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  priority: z.number().int().optional(),
  trigger: z.enum(conversationTriggers),
  /** visit で、この場所に入ったときに始まる。 */
  place: z.string().min(1).optional(),
  /** visit で、条件を満たしたときに始まる確率（0〜1）。省略は必ず。 */
  chance: z.number().gt(0).max(1).optional(),
  participants: z.array(z.string().min(1)).min(1).max(3),
  minimumReached: z.number().int().nonnegative().default(0),
  /** 宿で過ごした夜の数がこれ以上。 */
  minimumNights: z.number().int().nonnegative().default(0),
  /** 最初の話者との親しさがこれ以上。仲間は一緒に過ごした積み重ね（`like`）、悪魔は異なる会話を読んだ数。 */
  minimumBond: z.number().int().nonnegative().optional(),
  /** 友達同士の共同会話を、どちらへの話しかけからも選べる。 */
  sharedTalk: z.boolean().optional(),
  requiresCleared: z.boolean().default(false),
  /** ギルドで名前を登録したあとだけ出る。 */
  requiresRegistered: z.boolean().optional(),
  /** すべて立っていれば出る。 */
  requires: z.array(flag).default([]),
  /** どれか立っていれば出ない。 */
  excludes: z.array(flag).default([]),
  /** 見終えたときに立てる。 */
  sets: z.array(flag).default([]),
  once: z.boolean().default(false),
  lines: z.array(lineSchema).min(1),
  /** 最後の行のあとにプレイヤーへ尋ねる。選んだ答えで返事と立つフラグが変わる。 */
  choice: z
    .strictObject({
      ask: z.string().min(1),
      options: z
        .array(
          z.strictObject({
            label: z.string().min(1),
            lines: z.array(lineSchema).min(1),
            sets: z.array(flag).default([]),
          })
        )
        .min(2)
        .max(3),
    })
    .optional(),
})
export type ConversationDefinition = WizDeepReadonly<
  z.output<typeof conversationSchema>
>
export type ConversationTrigger = (typeof conversationTriggers)[number]
/** 話しかけた住人（talk）や入った場所（visit）。 */
export type ConversationSubject = { resident?: string; place?: string }
