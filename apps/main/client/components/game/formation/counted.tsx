import { useStage } from "@/client/components/stage/use-stage"
import { parallel } from "@/client/components/canvas/parallel"
import { useAnimationEffect } from "@/client/components/canvas/use-animation-effect"
import type { CSSProperties } from "react"
import { useRef } from "react"
import { REVERT } from "@/client/components/canvas/tokens"
import { countUp } from "@/client/components/stage/count-up"
import { play } from "@/client/components/canvas/play"
import { useFormation } from "@/client/components/game/formation/context"

/** 変わった数字を数え上げる。 */
type Props = {
  value: number
  className?: string
  style?: CSSProperties
  children?: React.ReactNode
}

export function Counted(props: Props) {
  const { frozen } = useFormation()
  const stage = useStage()
  const ref = useRef<HTMLSpanElement>(null)
  const previous = useRef(props.value)
  useAnimationEffect(() => {
    if (frozen || previous.current === props.value) return
    stage.updates.track(
      parallel(() => {
        countUp(ref.current, previous.current, props.value, 420)
        play(
          ref.current?.parentElement,
          [
            {
              scale: 1.5,
              color: props.value > previous.current ? "#c3dbc8" : "#aa9fd4",
            },
            { scale: 1, color: "#dcdee5" },
          ],
          {
            duration: 500,
            easing: "cubic-bezier(.34,1.56,.64,1)",
          }
        )
        previous.current = props.value
      })
    )
  }, [props.value, frozen])
  return (
    <div
      className={props.className}
      style={{ ...REVERT, display: "block", ...props.style }}
    >
      <span ref={ref}>{frozen ? previous.current : props.value}</span>
      {props.children}
    </div>
  )
}
