import { COLOR, EASE_OUT } from "@/client/components/stage/kit"
import { play } from "@/client/components/canvas/play"
import { useRun } from "@/client/components/stage/fx/use-run"
import type { Done } from "@/client/components/stage/fx/use-run"

type Props = { color?: string; strength?: number } & Done

export function Flash(props: Props) {
  const color = props.color === undefined ? COLOR.mist : props.color
  const strength = props.strength === undefined ? 0.6 : props.strength

  const ref = useRun(
    (el) => [
      play(el, [{ opacity: strength }, { opacity: 0 }], {
        duration: 380,
        easing: EASE_OUT,
        fill: "both",
      }),
    ],
    props.done
  )
  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        inset: 0,
        background: color,
        mixBlendMode: "screen",
      }}
    />
  )
}
