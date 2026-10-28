import { useRef, useState } from "react"
import { useDialogInput } from "@/client/components/canvas/use-dialog-input"
import {
  BUTTON_BASE,
  IMG_BASE,
  PALETTE,
  REVERT,
} from "@/client/components/canvas/tokens"
import { useGame } from "@/client/contexts/use-game"
import { useGameState } from "@/client/contexts/use-game-state"
import { frameOf } from "@/content/looks/frame-of"
import { personOf } from "@/content/looks/person-of"
import { GameCommandError } from "@/lib/wiz/game/game-command-error"
import { inPhase } from "@/lib/wiz/phases/in-phase"
import { useWide } from "@/client/components/stage/use-wide"

/** 街の主人公詳細から容姿を変更。選んでいる間はゲーム状態を書き換えない。 */
type Props = { onClose: () => void }

export function HeroAppearance(props: Props) {
  const game = useGame()
  const state = useGameState()
  const wide = useWide()
  const hero = game.queries.hero(state)
  const dialog = useRef<HTMLDivElement>(null)
  const dialogInput = useDialogInput(
    dialog,
    props.onClose,
    '[aria-pressed="true"]'
  )
  const [selected, setSelected] = useState(hero.look)
  const [outfit, setOutfit] = useState(hero.outfit)
  const [failed, setFailed] = useState(false)
  const decide = () => {
    if (selected === hero.look && outfit === hero.outfit) return props.onClose()
    const result = inPhase(game, "town")?.chooseHeroLook(selected, outfit)
    if (!result || result instanceof GameCommandError) return setFailed(true)
    props.onClose()
  }
  return (
    <div
      className="hero-appearance"
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label="容姿を変える"
      tabIndex={-1}
      {...dialogInput}
      style={{
        ...REVERT,
        position: "absolute",
        zIndex: 42,
        inset: "10% 5%",
        padding: "clamp(12px, 2.4vmin, 24px)",
        maxWidth: 700,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        background: PALETTE.ink,
        color: PALETTE.paper,
        pointerEvents: "auto",
      }}
    >
      <strong style={{ ...REVERT, fontSize: "clamp(20px, 4vmin, 32px)" }}>
        容姿を変える
      </strong>
      <div
        style={{
          ...REVERT,
          display: "grid",
          gridTemplateColumns: `repeat(${wide ? 4 : 2}, minmax(0, 1fr))`,
          gridTemplateRows: wide
            ? "minmax(0, 1fr)"
            : "repeat(2, minmax(0, 1fr))",
          gap: 10,
          flex: 1,
          minHeight: 0,
        }}
      >
        {hero.looks.map(({ id }) => (
          <button
            type="button"
            key={id}
            aria-label={`容姿 ${personOf(id)?.name ?? id}`}
            aria-pressed={selected === id}
            onClick={() => setSelected(id)}
            style={{
              ...BUTTON_BASE,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              minHeight: 0,
              minWidth: 0,
              padding: 6,
              background: selected === id ? PALETTE.deep : "transparent",
              border: `3px solid ${selected === id ? PALETTE.sage : PALETTE.stone}`,
              color: PALETTE.paper,
            }}
          >
            <img
              src={frameOf(id, outfit).img}
              alt=""
              style={{
                ...IMG_BASE,
                objectFit: "contain",
                width: "100%",
                flex: 1,
                minHeight: 0,
              }}
            />
            <span style={{ ...REVERT, fontSize: 14 }}>
              {personOf(id)?.name}
            </span>
          </button>
        ))}
      </div>
      <label
        style={{
          ...REVERT,
          fontSize: 14,
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        衣装
        <select
          aria-label="主人公の衣装"
          value={outfit ?? ""}
          onChange={(event) => setOutfit(event.target.value || null)}
          style={{
            ...REVERT,
            minHeight: 44,
            padding: "6px 8px",
            color: PALETTE.ink,
            background: PALETTE.paper,
            maxWidth: "100%",
          }}
        >
          <option value="">いつもの服</option>
          {hero.outfits.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
        <span>見た目だけ変わる。能力は変わらない。</span>
      </label>
      {failed ? <span role="alert">容姿を変更できませんでした。</span> : null}
      <div
        style={{
          ...REVERT,
          display: "flex",
          gap: 12,
          justifyContent: "flex-end",
        }}
      >
        <button
          type="button"
          className="word"
          aria-label="容姿の変更をやめる"
          data-modal-close
          onClick={props.onClose}
          style={{
            ...BUTTON_BASE,
            minHeight: 44,
            padding: "8px 12px",
            color: PALETTE.paper,
          }}
        >
          やめる
        </button>
        <button
          type="button"
          className="word cta"
          aria-label="この容姿にする"
          onClick={decide}
          style={{
            ...BUTTON_BASE,
            minHeight: 44,
            padding: "8px 16px",
            background: PALETTE.paper,
            color: PALETTE.ink,
            fontWeight: 800,
          }}
        >
          この容姿にする
        </button>
      </div>
    </div>
  )
}
