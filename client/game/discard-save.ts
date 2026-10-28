import type { Game } from "@/lib/wiz/game/game"
import type { SaveStorage } from "@/client/game/save-storage"
import type { SaveReport, Session } from "@/client/game/storage"
import { autosave } from "@/client/game/autosave"
import { reasons } from "@/client/game/reasons"

/** 読めない保存を消して、今の（はじめからの）状態で保存し直す。遊ぶ人が選んだときだけ呼ぶ。 */
export async function discardSave(
  game: Game,
  storage: SaveStorage,
  report?: SaveReport
): Promise<Session> {
  try {
    const value = JSON.stringify(game.save())
    await storage.clear()
    await storage.write(value)
    return {
      status: "fresh",
      problems: [],
      ...autosave(game, storage, report),
    }
  } catch (error) {
    return {
      status: "unreadable",
      problems: reasons(error),
      disconnect: () => {},
    }
  }
}
