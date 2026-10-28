import { useRef, useState } from "react"
import { COLOR } from "@/client/components/stage/kit"
import { useFx } from "@/client/components/stage/use-fx"
import { useWide } from "@/client/components/stage/use-wide"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { eventsOf } from "@/lib/wiz/phases/events-of"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import { katakanaOf } from "@/lib/wiz/rules/katakana-of"
import { useGame } from "@/client/contexts/use-game"
import { useGameState } from "@/client/contexts/use-game-state"
import { BUTTON_BASE, REVERT } from "@/client/components/canvas/tokens"
import { NameField } from "@/client/components/canvas/name-field"
import { useDialogInput } from "@/client/components/canvas/use-dialog-input"

/** 主人公の名前を変える板。日本語の変換を確定するEnterでは、名前を決めない。 */
type Props = {
  current: string
  onClose: () => void
}

export function RenamePanel(props: Props) {
  const game = useGame()
  const state = useGameState()
  const fx = useFx()
  const wide = useWide()
  const hero = game.queries.hero(state)
  const dialog = useRef<HTMLDivElement>(null)
  const dialogInput = useDialogInput(dialog, props.onClose, "input")
  const [name, setName] = useState(props.current)
  const accepted = game.queries.heroNameAccepted(name)
  const decide = () => {
    if (!accepted) {
      fx.shake(0.6)
      return
    }
    const result = eventsOf(inPhase(game, "town")?.renameHero(name))
    if (result instanceof GameCommandError && name.trim() !== props.current) {
      fx.shake(0.6)
      return
    }
    props.onClose()
  }
  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="名前を変える"
      tabIndex={-1}
      {...dialogInput}
      className="rename"
      style={{
        ...REVERT,
        display: "grid",
        gap: "calc(var(--u)*2)",
        position: "absolute",
        zIndex: 41,
        background: "rgb(11 12 18 / 0.92)",
        padding: "calc(var(--u)*3)",
        clipPath: "polygon(1% 3%, 100% 0, 99% 98%, 0 100%)",
        ...(wide
          ? { left: "30%", right: "30%", top: "24%" }
          : { left: "5%", right: "5%", top: "26%" }),
      }}
    >
      <b
        style={{
          ...REVERT,
          display: "block",
          fontSize: "calc(var(--u)*4)",
          color: COLOR.mist,
        }}
      >
        名前を変える
      </b>
      <NameField
        label="名前（カタカナ）"
        value={name}
        onChange={setName}
        normalize={katakanaOf}
        onSubmit={decide}
        maxLength={hero.maxName}
        placeholder="カタカナで記入"
      />
      <span
        style={{
          ...REVERT,
          display: "flex",
          gap: "calc(var(--u)*2)",
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          aria-label="やめる"
          data-modal-close
          onClick={props.onClose}
          style={{
            ...BUTTON_BASE,
            padding: "calc(var(--u)*.6) calc(var(--u)*2)",
            fontSize: "calc(var(--u)*3)",
            fontWeight: 800,
            color: COLOR.paper,
            boxShadow: `inset 0 0 0 calc(var(--u)*.35) ${COLOR.paper}`,
          }}
        >
          やめる
        </button>
        <button
          type="button"
          aria-label="この名前にする"
          onClick={decide}
          style={{
            ...BUTTON_BASE,
            padding: "calc(var(--u)*.6) calc(var(--u)*2)",
            fontSize: "calc(var(--u)*3)",
            fontWeight: 800,
            color: COLOR.ink,
            background: accepted ? COLOR.paper : COLOR.stone,
          }}
        >
          この名前にする
        </button>
      </span>
    </div>
  )
}
