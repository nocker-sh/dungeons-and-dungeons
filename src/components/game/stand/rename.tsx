import { useState } from "react"
import { COLOR } from "@/components/stage/kit"
import { useFx } from "@/components/stage/use-fx"
import { useWide } from "@/components/stage/word"
import { GameCommandError, eventsOf, inPhase, katakanaOf } from "@/lib/wiz"
import { useGame, useGameState } from "@/contexts/game"
import { BUTTON_BASE, REVERT } from "@/components/canvas/tokens"
import { NameField } from "@/components/canvas/name-field"

/** 主人公の名前を変える板。決めるのはボタン（日本語の変換中の Enter では決まらない）。 */
export function RenamePanel({
  current,
  onClose,
}: {
  current: string
  onClose: () => void
}) {
  const game = useGame()
  const state = useGameState()
  const fx = useFx()
  const wide = useWide()
  const hero = game.queries.hero(state)
  const [name, setName] = useState(current)
  const accepted = game.queries.heroNameAccepted(name)
  const decide = () => {
    if (!accepted) {
      fx.shake(0.6)
      return
    }
    const result = eventsOf(inPhase(game, "town")?.renameHero(name))
    if (result instanceof GameCommandError && name.trim() !== current) {
      fx.shake(0.6)
      return
    }
    onClose()
  }
  return (
    <div
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
          onClick={onClose}
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
