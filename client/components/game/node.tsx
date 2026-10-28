import { useRef } from "react"
import { motion } from "motion/react"
import { Svg } from "@/client/components/game/svg"
import { useActiveMark } from "@/client/components/canvas/use-active-mark"
import { usePointerState } from "@/client/components/canvas/use-pointer-state"
import { PALETTE, REVERT, unit } from "@/client/components/canvas/tokens"
import { MOTION_EASE } from "@/client/components/stage/kit"
import { TornLabel } from "@/client/components/canvas/torn-label"
import { TornPlate } from "@/client/components/canvas/torn-plate"

export const TILE_CLIP =
  "polygon(6% 10%, 62% 0, 100% 14%, 94% 86%, 40% 100%, 0 88%)"

/** 道のり図の地点ひとつ。分岐では押して行き先を選ぶ。 */
type Props = {
  nodeRef: (el: HTMLDivElement | null) => void
  /** 地点の絵札を親へ預ける（着いたときにめくれる）。 */
  tileRef: (el: HTMLDivElement | null) => void
  point: { x: number; y: number }
  size: number
  startSize: number
  tilt: number
  isStart: boolean
  boss: boolean
  now: boolean
  off: boolean
  choosing: boolean
  chosen: boolean
  icon: string | null
  onPick: () => void
}

export function Node(props: Props) {
  const ref = useRef<HTMLDivElement | null>(null)
  const active = useActiveMark(ref)
  const pointer = usePointerState()
  const light = props.now || props.chosen
  return (
    // 選べる地点は、選んだ方を大きく（1.12）、選ばない方を小さく（0.62）して、0.9 秒ごとに 1.1 倍へ脈打つ。大きさは motion が持つ
    <motion.div
      initial={false}
      ref={(el) => {
        ref.current = el
        props.nodeRef(el)
      }}
      className={["node", props.choosing ? "pick" : ""].join(" ")}
      onClick={props.choosing ? props.onPick : undefined}
      {...(props.choosing ? pointer.handlers : {})}
      animate={{
        scale: props.choosing
          ? [props.chosen ? 1.12 : 0.62, 1.1, props.chosen ? 1.12 : 0.62]
          : 1,
        filter: props.off
          ? "grayscale(1)"
          : props.choosing && !props.chosen
            ? "brightness(0.7)"
            : "none",
        opacity: props.off ? 0.28 : 1,
      }}
      transition={{
        ...(props.choosing
          ? { duration: 0.9, ease: "easeInOut", repeat: Infinity }
          : { duration: 0.4, ease: MOTION_EASE.pop }),
        filter: { duration: 0.3, ease: "easeInOut", repeat: 0 },
        opacity: { duration: 0.3, ease: "easeInOut", repeat: 0 },
      }}
      style={{
        ...REVERT,
        position: "absolute",
        left: props.point.x,
        top: props.point.y,
        translate: "-50% -50%",
        display: "grid",
        placeItems: "center",

        pointerEvents: props.choosing ? "auto" : undefined,
        cursor: props.choosing ? "pointer" : undefined,
      }}
    >
      <div
        ref={props.tileRef}
        style={{
          ...REVERT,
          position: "relative",
          display: "grid",
          placeItems: "center",
          width: props.size,
          aspectRatio: 1.05,
          rotate: `${props.tilt}deg`,
          scale: props.choosing && pointer.hover ? 1.08 : undefined,
        }}
      >
        <TornPlate
          background={
            props.choosing
              ? props.chosen
                ? PALETTE.paper
                : PALETTE.ink
              : props.now
                ? PALETTE.paper
                : props.boss
                  ? PALETTE.blood
                  : PALETTE.ink
          }
          clip={TILE_CLIP}
        />
        <TornPlate
          clip={TILE_CLIP}
          style={{
            inset: "7%",
            boxShadow: `inset 0 0 0 ${unit(props.choosing && active ? 0.9 : 0.45)} ${props.choosing && active ? PALETTE.blood : PALETTE.paper}`,
          }}
        />
        {props.isStart ? (
          <span
            style={{
              ...REVERT,
              position: "relative",
              fontSize: props.startSize * 0.35,
              lineHeight: 1,
              color: light ? PALETTE.ink : PALETTE.paper,
            }}
          >
            開始
          </span>
        ) : props.icon ? (
          <Svg
            html={props.icon}
            style={{
              position: "relative",
              width: "62%",
              height: "62%",
              filter: props.now ? "invert(1)" : undefined,
            }}
          />
        ) : (
          <span
            style={{
              ...REVERT,
              position: "relative",
              fontSize: props.size * 0.62,
              lineHeight: 1,
              color: light ? PALETTE.ink : PALETTE.paper,
            }}
          >
            ？
          </span>
        )}
      </div>
      {props.choosing ? (
        <TornLabel
          background={props.chosen ? PALETTE.blood : PALETTE.paper}
          color={props.chosen ? PALETTE.paper : PALETTE.ink}
          clip="polygon(3% 0, 100% 8%, 97% 100%, 0 92%)"
          style={{
            position: "absolute",
            left: "50%",
            bottom: "100%",
            translate: "-50% -0.3em",
            whiteSpace: "nowrap",
            fontSize: unit(3.4),
            padding: "0.1em 0.6em",
            pointerEvents: "none",
          }}
        >
          {props.chosen ? "▶ こっちへ進む" : "こっち？"}
        </TornLabel>
      ) : null}
    </motion.div>
  )
}
