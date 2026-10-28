import type { Game } from "@/lib/wiz/game/game"
import type { SaveStorage } from "@/client/game/save-storage"
import type { SaveReport } from "@/client/game/storage"

export function autosave(
  game: Game,
  storage: SaveStorage,
  report?: SaveReport
) {
  let connected = true
  let revision = 0
  const save = (): Promise<void> => {
    if (!connected) return Promise.resolve()
    const current = ++revision
    const complete = (saved: boolean) => {
      // 古い通信の完了で、新しい保存の失敗を消さない。
      if (connected && current === revision) report?.(saved)
    }
    try {
      const pending = storage.write(JSON.stringify(game.save()))
      if (pending)
        return pending.then(
          () => complete(true),
          () => complete(false)
        )
      complete(true)
    } catch {
      complete(false)
    }
    return Promise.resolve()
  }
  const unsubscribe = game.subscribe(() => void save())
  return {
    retrySave: save,
    disconnect: () => {
      connected = false
      unsubscribe()
    },
  }
}
