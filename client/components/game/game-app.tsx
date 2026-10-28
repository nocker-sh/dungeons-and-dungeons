import { VisitScenesContext } from "@/client/components/game/use-visit-scene"
import { StartOverContext } from "@/client/components/game/settings-panel"
import { GameProvider } from "@/client/contexts/game-provider"
import type { Game } from "@/lib/wiz/game/game"
import { useGameSession } from "@/client/game/use-game-session"
import type { PreviewStart } from "@/client/dev/preview-start"
import { BootProblems } from "@/client/components/game/boot-problems"
import { Shell } from "@/client/components/game/shell"

/** 起動。エンジンを作り、保存を読み込んでから画面を出す。 */
type Props = { preview?: PreviewStart; onReady?: (game: Game) => void }

export function GameApp(props: Props = {}) {
  const { boot, saveFailed, discard, startOver } = useGameSession(
    props.preview,
    props.onReady
  )
  if (!boot) return <div className="game" />
  if (boot.kind === "content") return <BootProblems problems={boot.problems} />
  if (boot.kind === "storage")
    return <BootProblems problems={boot.problems} storage />
  return (
    <GameProvider game={boot.game}>
      <StartOverContext value={startOver}>
        <VisitScenesContext
          value={!props.preview || props.preview.visitScenes === true}
        >
          <Shell
            game={boot.game}
            preview={props.preview}
            unreadable={
              boot.session.status === "unreadable"
                ? boot.session.problems
                : null
            }
            onDiscard={discard}
            saveFailed={saveFailed}
            onRetrySave={boot.session.retrySave}
          />
        </VisitScenesContext>
      </StartOverContext>
    </GameProvider>
  )
}
