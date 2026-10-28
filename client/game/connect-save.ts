import type { Game } from "@/lib/wiz/game/game"
import type { SaveStorage } from "@/client/game/save-storage"
import type { SaveReport, Session, SessionStatus } from "@/client/game/storage"
import { reasons } from "@/client/game/reasons"
import { autosave } from "@/client/game/autosave"

/**
 * 保存データを読み込み、以後の変化を書き戻す。
 * 読めない保存は上書きしない（自動保存をつながない）。消すかどうかは遊ぶ人が選ぶ。
 */
export function connectSave(
  game: Game,
  storage: SaveStorage,
  report?: SaveReport
): Session {
  let raw: string | null = null
  try {
    raw = storage.read()
  } catch (error) {
    return {
      status: "unreadable",
      problems: reasons(error),
      disconnect: () => {},
    }
  }
  let status: SessionStatus = "fresh"
  if (raw !== null) {
    try {
      const error = game.restore(JSON.parse(raw))
      if (error)
        return {
          status: "unreadable",
          problems: reasons(error.cause),
          disconnect: () => {},
        }
      status = "restored"
    } catch (error) {
      return {
        status: "unreadable",
        problems: reasons(error),
        disconnect: () => {},
      }
    }
  }
  return { status, problems: [], ...autosave(game, storage, report) }
}
