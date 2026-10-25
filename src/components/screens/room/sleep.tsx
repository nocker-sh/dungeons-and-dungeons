import { after } from "@/components/canvas/animation"
import { useAnimationEffect } from "@/components/canvas/use-animation"
import { useRef } from "react"
import { createPortal } from "react-dom"
import { COLOR, EASE_IN, EASE_OUT } from "@/components/stage/kit"
import { useStage } from "@/components/stage/stage-context"
import { COMIC } from "@/components/canvas/tokens"
import { play } from "@/components/canvas/play"

/** ZZZ… */
export function Sleep({ onDone }: { onDone: () => void }) {
  const stage = useStage()
  const ref = useRef<HTMLDivElement>(null)
  useAnimationEffect(() => {
    const el = ref.current
    const cover = play(
      el,
      [{ clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0 0)" }],
      { duration: 420, easing: EASE_IN, fill: "both" }
    )
    const text = after(cover, () =>
      play(
        el?.firstElementChild,
        [
          { transform: "scale(.4) rotate(-20deg)", opacity: 0 },
          { transform: "scale(1.1) rotate(-6deg)", opacity: 1, offset: 0.3 },
          { transform: "rotate(-6deg)", opacity: 1, offset: 0.8 },
          { transform: "translateY(-6vh) rotate(-6deg)", opacity: 0 },
        ],
        { duration: 1300, easing: EASE_OUT, fill: "both" }
      )
    )
    const exit = after(text, () =>
      play(
        el,
        [{ clipPath: "inset(0 0 0 0)" }, { clipPath: "inset(100% 0 0 0)" }],
        { duration: 420, easing: EASE_OUT, fill: "both" }
      )
    )
    after(exit, onDone)
  }, [])

  const root = stage.canvas.current
  if (!root) return null
  return createPortal(
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 35,
        background: COLOR.ink,
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
      }}
    >
      <span
        className="comic"
        style={{ ...COMIC, fontSize: "calc(var(--u)*14)" }}
      >
        ZZZ…
      </span>
    </div>,
    root
  )
}
