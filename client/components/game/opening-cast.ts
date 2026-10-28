import { STAGE_SLOTS } from "@/client/components/game/conversation-cast"

/** 最初に舞台に立つ人。先に話す順に、上限まで。話さない参加者は空いた枠に入れる。 */
export function openingCast(
  participants: readonly string[],
  speakers: readonly string[]
): string[] {
  const order = [...new Set([...speakers, ...participants])].filter((person) =>
    participants.includes(person)
  )
  return order.slice(0, Math.min(STAGE_SLOTS, participants.length))
}
