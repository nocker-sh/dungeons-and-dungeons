import type { Session } from "@/builder/lib/session"
import { fillParty } from "@/builder/lib/policy/fill-party"
import { chooseFirstPartner } from "@/builder/lib/policy/choose-first-partner"

/**
 * 遊び始めの準備：3人そろえ、開始時から契約したロクスと合体する。
 * ガチャや階級による相棒の自動入替はしない。
 */
export function startParty(session: Session) {
  const spent = fillParty(session)
  // 潜る前に召喚石を使い切る（街の一日と同じ）。一回目は必ず成功する
  // 最初のロクス契約を維持する。抽選・階級による自動切替はない。
  chooseFirstPartner(session)
  return spent
}
