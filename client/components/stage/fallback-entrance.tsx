import { CanvasButton } from "@/client/components/canvas/canvas-button"
import { FONT_FAMILY, PALETTE } from "@/client/components/canvas/tokens"
import { animationTiming } from "@/client/components/stage/timing"
import { useStage } from "@/client/components/stage/use-stage"
import { useGoing } from "@/client/components/stage/use-going"
import { focusMove } from "@/client/components/stage/focus-move"
import type { EntranceLink } from "@/client/components/stage/entrance-links-shared"

/** 絵の中の位置が分からないときは、移動先を重ならない一覧にする。 */
type Props = { link: EntranceLink }

export function FallbackEntrance(props: Props) {
  const stage = useStage()
  const { leaving, going, mark, completion } = useGoing()
  return (
    <CanvasButton
      data-entrance={props.link.id}
      data-leaving={mark}
      aria-label={props.link.label}
      disabled={going || props.link.disabled}
      onClick={(event) => {
        if (!going && !props.link.disabled)
          props.link.onClick(focusMove(stage, { element: event.currentTarget }))
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: leaving ? 0 : props.link.disabled ? 0.38 : 1 }}
      transition={{
        duration:
          (leaving ? animationTiming.exit : animationTiming.enter) / 1000,
      }}
      {...completion}
      style={{
        minHeight: 48,
        padding: "12px 10px",
        border: `2px solid ${PALETTE.paper}`,
        background: props.link.primary ? PALETTE.paper : PALETTE.ink,
        color: props.link.primary ? PALETTE.ink : PALETTE.paper,
        fontFamily: FONT_FAMILY,
        fontSize: 20,
        fontWeight: 900,
        lineHeight: 1.2,
        textAlign: "center",
      }}
    >
      {props.link.label}
    </CanvasButton>
  )
}
