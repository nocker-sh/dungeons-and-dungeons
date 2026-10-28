import { STAGE_SLOTS } from "@/client/components/game/conversation-cast"

/** 一行ごとの、話し手が立つ枠と、その行で舞台に立っている人（枠の順）。 */
export type CastLine = { slot: number; cast: readonly string[] }

/**
 * 台本の行を、立ち絵の枠へ割り当てる。舞台にいない人が話すときは、直前に話していない方の枠を空けて入れ替える。
 * start は前の行の終わりの舞台（選択肢の返事は本文の終わりから続ける）。
 */
export function castLines(
  start: readonly string[],
  speakers: readonly string[]
): { lines: CastLine[]; end: readonly string[] } {
  let cast = [...start]
  let previous: string | null = null
  const lines = speakers.map((speaker) => {
    let slot = cast.indexOf(speaker)
    if (slot < 0) {
      if (cast.length < STAGE_SLOTS) {
        cast = [...cast, speaker]
        slot = cast.length - 1
      } else {
        slot = cast[0] === previous ? 1 : 0
        cast = cast.map((person, index) => (index === slot ? speaker : person))
      }
    }
    previous = speaker
    return { slot, cast }
  })
  return { lines, end: cast }
}
