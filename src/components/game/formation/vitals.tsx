import { useStage } from "@/components/stage/stage-context"
import { useAnimationCompletion } from "@/components/stage/use-exit"
import { parallel } from "@/components/canvas/animation"
import { useAnimationEffect } from "@/components/canvas/use-animation"
import { type CSSProperties, useRef } from "react"
import { motion } from "motion/react"
import { PALETTE, REVERT, unit } from "@/components/canvas/tokens"
import { countUp } from "@/components/stage/kit"
import { play } from "@/components/canvas/play"
import { useFormation } from "./context"

/** 変わった数字を数え上げる。 */
export function Counted({
  value,
  className,
  style,
  children,
}: {
  value: number
  className?: string
  style?: CSSProperties
  children?: React.ReactNode
}) {
  const { frozen } = useFormation()
  const stage = useStage()
  const ref = useRef<HTMLSpanElement>(null)
  const previous = useRef(value)
  useAnimationEffect(() => {
    if (frozen || previous.current === value) return
    stage.updates.track(
      parallel(() => {
        countUp(ref.current, previous.current, value, 420)
        play(
          ref.current?.parentElement,
          [
            {
              scale: 1.5,
              color: value > previous.current ? "#c3dbc8" : "#aa9fd4",
            },
            { scale: 1, color: "#dcdee5" },
          ],
          {
            duration: 500,
            easing: "cubic-bezier(.34,1.56,.64,1)",
          }
        )
        previous.current = value
      })
    )
  }, [value, frozen])
  return (
    <div
      className={className}
      style={{ ...REVERT, display: "block", ...style }}
    >
      <span ref={ref}>{frozen ? previous.current : value}</span>
      {children}
    </div>
  )
}

/**
 * HP（生命力）の帯と、続きにつながる防具の耐久の帯。
 * 幅は最大HPと最大の耐久の比で分け、減った分は右から削る。
 */
export function LifeGauge({
  hp,
  maxHp,
  armor,
  width,
}: {
  hp: number
  maxHp: number
  armor: { durability: number; maxDurability: number } | null
  width: string
}) {
  const segment = (value: number, max: number, color: string, grow: number) => (
    <LifeSegment value={value} maximum={max} color={color} grow={grow} />
  )
  return (
    <span
      aria-hidden="true"
      style={{
        ...REVERT,
        display: "flex",
        width,
        marginTop: unit(0.7),
        marginLeft: "auto",
        height: unit(1.1),
        background: PALETTE.ink,
        boxShadow: `0 0 0 ${unit(0.2)} ${PALETTE.ink}`,
        clipPath: "polygon(0 0,100% 0,98% 100%,2% 100%)",
      }}
    >
      {segment(
        hp,
        maxHp,
        hp / maxHp < 0.3 ? PALETTE.lavender : PALETTE.mist,
        maxHp
      )}
      {armor ? (
        <>
          <span
            style={{ ...REVERT, width: unit(0.3), background: PALETTE.night }}
          />
          {segment(
            armor.durability,
            armor.maxDurability,
            PALETTE.dusk,
            armor.maxDurability
          )}
        </>
      ) : null}
    </span>
  )
}

function LifeSegment({
  value,
  maximum: max,
  color,
  grow,
}: {
  value: number
  maximum: number
  color: string
  grow: number
}) {
  const completion = useAnimationCompletion(useStage().updates)
  return (
    <span
      style={{
        ...REVERT,
        position: "relative",
        flex: `${grow} 0 0`,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <motion.span
        {...completion}
        initial={false}
        transition={{
          right: { duration: 0.4, ease: [0.16, 1, 0.3, 1], repeat: 0 },
        }}
        animate={{ right: `${100 - (value / Math.max(1, max)) * 100}%` }}
        style={{
          ...REVERT,
          position: "absolute",
          inset: 0,

          background: color,
        }}
      />
    </span>
  )
}
