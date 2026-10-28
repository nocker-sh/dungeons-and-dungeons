import { motion } from "motion/react"
import { useLayoutEffect, useRef } from "react"
import type { CSSProperties } from "react"
import { frameOf } from "@/content/looks/frame-of"
import { EASE_OUT } from "@/client/components/stage/kit"
import { PALETTE, REVERT, unit } from "@/client/components/canvas/tokens"
import { play } from "@/client/components/canvas/play"
import { FoeArt } from "@/client/components/screens/battle/foe-art"
import type { BattleView } from "@/client/components/screens/battle/types"
import { useGame } from "@/client/contexts/use-game"
import { useGameState } from "@/client/contexts/use-game-state"

export const FACE_CLIP =
  "polygon(6% 10%, 62% 0, 100% 14%, 94% 86%, 40% 100%, 0 88%)"

/** 行動順：生きている者を速さの順に並べ、左上のリボルバーで見せる。 */
type Props = { view: BattleView }

export function Order(props: Props) {
  const game = useGame()
  const state = useGameState()
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    play(
      ref.current,
      [{ transform: "translateX(-40vw)" }, { transform: "none" }],
      { duration: 600, easing: EASE_OUT, fill: "both" }
    )
  }, [])
  const n = props.view.order.length
  const slots: { k: number; d: number; entry: BattleView["order"][number] }[] =
    []
  let d = 0
  for (
    let k = props.view.turn;
    k < props.view.turn + n * 2 && slots.length < 4;
    k++
  ) {
    const entry = props.view.order[k % n]
    if (!entry.alive && k !== props.view.turn) continue
    slots.push({ k, d: d++, entry })
  }
  const now = props.view.order[props.view.turn % n]
  return (
    <div
      ref={ref}
      className="order"
      aria-live="polite"
      aria-label={`行動順：いまは${now.name}`}
      style={{
        ...REVERT,
        display: "block",
        position: "absolute",
        left: 0,
        top: 0,
        width: "30%",
        height: "60%",
        zIndex: 23,
        pointerEvents: "none",
      }}
    >
      {slots.map(({ k, d: offset, entry }) => {
        const member =
          entry.ref.kind === "member"
            ? game.queries.member(state, entry.ref.id)
            : null
        const frame = frameOf(
          entry.look,
          member?.armor?.good,
          member?.pact?.find((mode) => mode.current)?.index
        )
        const foe =
          entry.ref.kind === "foe"
            ? props.view.foes.find((f) => f.id === entry.ref.id)
            : null
        const current = offset === 0
        const far = Math.abs(offset)
        // 顔の枠が縮む分だけ速さの文字も寄せる
        const faceScale =
          1 - Math.min(1, far) * 0.45 - Math.max(0, far - 1) * 0.08
        const outline: CSSProperties = {
          ...REVERT,
          position: "absolute",
          inset: 0,
          clipPath: FACE_CLIP,
          boxShadow: `inset 0 0 0 ${unit(current ? 0.9 : 0.5)} ${PALETTE.paper}`,
        }
        return (
          <motion.div
            initial={false}
            transition={{
              rotate: { duration: 0.55, ease: [0.34, 1.5, 0.64, 1], repeat: 0 },
              opacity: { duration: 0.35, ease: "easeInOut", repeat: 0 },
            }}
            animate={{
              rotate: `${offset * 11 - 2}deg`,
              opacity: 1 - Math.max(0, far - 0.5) * 0.3,
            }}
            key={k}
            aria-hidden="true"
            style={{
              ...REVERT,
              position: "absolute",
              left: "0.6%",
              top: "9%",
              transformOrigin: "-34vmax 50%",
            }}
          >
            <motion.div
              initial={false}
              transition={{
                scale: {
                  duration: 0.55,
                  ease: [0.34, 1.5, 0.64, 1],
                  repeat: 0,
                },
              }}
              animate={{ scale: faceScale }}
              style={{
                ...REVERT,
                position: "relative",
                width: unit(14),
                aspectRatio: 1,
                overflow: "hidden",
                transformOrigin: "0 50%",

                clipPath: FACE_CLIP,
                background: foe ? PALETTE.blood : PALETTE.ink,
              }}
            >
              {foe ? (
                <div
                  style={{
                    ...REVERT,
                    position: "absolute",
                    inset: "8%",
                  }}
                >
                  <FoeArt foe={foe.foe} appearanceId={foe.appearanceId} />
                </div>
              ) : (
                <img
                  src={frame.bust ?? frame.img}
                  alt=""
                  style={{
                    ...REVERT,
                    display: "block",
                    maxWidth: "none",
                    position: "absolute",
                    left: "50%",
                    top: 0,
                    width: "240%",
                    translate: `${-frame.fx * 100}% 0`,
                  }}
                />
              )}
              <span style={outline} />
            </motion.div>
            <motion.span
              initial={false}
              transition={{
                scale: { duration: 0.55, ease: "easeInOut", repeat: 0 },
              }}
              animate={{ scale: 1 - Math.min(1, far) * 0.3 }}
              style={{
                ...REVERT,
                position: "absolute",
                left: `calc(var(--u) * ${14 * faceScale + 1.2})`,
                top: current ? "16%" : "30%",
                whiteSpace: "nowrap",
                fontSize: unit(current ? 2.6 : 2.2),
                color: PALETTE.paper,
                textShadow: `0 0 5px ${PALETTE.ink}`,

                transformOrigin: "0 50%",
              }}
            >
              {/* 名前は出さない。手番の者は顔だけ、次からは速さを添える */}
              {current ? null : (
                <span style={REVERT}>
                  速<b style={{ ...REVERT, fontSize: "1.8em" }}>{entry.spd}</b>
                </span>
              )}
            </motion.span>
          </motion.div>
        )
      })}
    </div>
  )
}
