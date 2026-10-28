import { useEffect, useRef, useState } from "react"
import { ContentError } from "@/lib/wiz/content/content-error"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import type { Game } from "@/lib/wiz/game/game"
import { gameContent } from "@/content/game-content"
import type { PreviewStart } from "@/client/dev/preview-start"
import { BrowserStorage } from "./browser-storage"
import { DevFileStorage, wantsDevFileSave } from "./dev-file-storage"
import { MemoryStorage } from "./memory-storage"
import { connectSave } from "@/client/game/connect-save"
import { discardSave } from "@/client/game/discard-save"
import type { Session } from "@/client/game/storage"
import type { SaveStorage } from "@/client/game/save-storage"

export type GameBoot =
  | { kind: "ready"; game: Game; storage: SaveStorage; session: Session }
  | { kind: "content"; problems: readonly string[] }
  | { kind: "storage"; problems: readonly string[] }

type Lifetime = { active: boolean; resetting: boolean; session: Session | null }

/** 一つの画面の起動・復元・保存接続を所有し、画面を離れた後の完了通知を破棄する。 */
export function useGameSession(
  preview?: PreviewStart,
  onReady?: (game: Game) => void
) {
  const [boot, setBoot] = useState<GameBoot | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  const lifetime = useRef<Lifetime | null>(null)

  const report = (scope: Lifetime, saved: boolean) => {
    if (scope.active) setSaveFailed(!saved)
  }

  useEffect(() => {
    const scope: Lifetime = { active: true, resetting: false, session: null }
    lifetime.current = scope
    void (async () => {
      // 取り消された試行では、エンジンの生成や乱数の消費も始めない。
      await Promise.resolve()
      if (!scope.active) return
      let game: Game
      try {
        game = new GameDefinition(preview?.content ?? gameContent).create(
          preview?.environment,
          preview?.initialState
        )
        if (preview?.save) {
          const failed = game.restore(preview.save)
          if (failed) throw failed
        }
      } catch (error) {
        if (scope.active)
          setBoot({
            kind: "content",
            problems:
              error instanceof ContentError ? error.problems : [String(error)],
          })
        return
      }
      const storage = preview
        ? new MemoryStorage()
        : wantsDevFileSave()
          ? await DevFileStorage.load()
          : new BrowserStorage()
      if (!scope.active) return
      const session = connectSave(game, storage, (saved) =>
        report(scope, saved)
      )
      scope.session = session
      setBoot({ kind: "ready", game, storage, session })
      onReady?.(game)
    })()
    return () => {
      scope.active = false
      scope.session?.disconnect()
    }
    // 起動条件はマウント時に固定する。別のプレビューは親がkeyを変えて起動する。
  }, [])

  const discard = async () => {
    const scope = lifetime.current
    if (boot?.kind !== "ready" || !scope?.active || scope.resetting) return
    scope.resetting = true
    try {
      const session = await discardSave(boot.game, boot.storage, (saved) =>
        report(scope, saved)
      )
      if (!scope.active) {
        session.disconnect()
        return
      }
      scope.session?.disconnect()
      scope.session = session
      setBoot({ ...boot, session })
    } finally {
      scope.resetting = false
    }
  }

  const startOver =
    preview || boot?.kind !== "ready"
      ? null
      : async () => {
          const scope = lifetime.current
          if (!scope?.active || scope.resetting) return
          scope.resetting = true
          scope.session?.disconnect()
          try {
            await boot.storage.clear()
            if (scope.active) location.reload()
          } catch (error) {
            if (scope.active)
              setBoot({
                kind: "storage",
                problems: [
                  error instanceof Error ? error.message : String(error),
                ],
              })
          } finally {
            scope.resetting = false
          }
        }

  return { boot, saveFailed, discard, startOver }
}
