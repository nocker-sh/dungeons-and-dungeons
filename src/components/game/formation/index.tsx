import { after } from "@/components/canvas/animation"
import { useAnimationEffect } from "@/components/canvas/use-animation"
import { useRef, useState } from "react"
import { motion } from "motion/react"
import { REVERT } from "@/components/canvas/tokens"
import { seconds } from "@/components/stage/kit"
import { useWideFormation } from "@/components/stage/word"
import { useGameState } from "@/contexts/game"
import { play } from "@/components/canvas/play"
import { useFormation } from "./context"
import { Card } from "./card"
import { BagButton } from "./bag-button"

/** 隊列（Formation）：常に下端。押すと立ち絵が上がってくる。左上にバッグ。 */
export function Formation() {
  const state = useGameState()
  const formation = useFormation()
  const wide = useWideFormation()
  const bag = useRef<HTMLButtonElement>(null)
  const [entered, setEntered] = useState(false)
  useAnimationEffect(() => {
    const entrance = play(
      bag.current,
      [{ transform: "translateY(40vh) rotate(-40deg)" }, { transform: "none" }],
      {
        duration: 650,
        delay: 1100,
        easing: "cubic-bezier(.34,1.56,.64,1)",
        fill: "both",
      }
    )
    after(entrance, () => setEntered(true))
  }, [])
  return (
    <div style={{ ...REVERT, position: "absolute", inset: 0 }}>
      {/* 戦闘中はバッグを開けないので出さない */}
      {state.phase.type !== "battle" ? (
        <BagButton
          buttonRef={bag}
          open={formation.bagOpen}
          collapsed={formation.cardsHidden}
          onClick={formation.openBag}
        />
      ) : null}
      {/* バッグを開いている間は札を画面の下へ引っ込め、押せなくする（バッグのボタンは残す）。隊列の高さは0になるので、距離は画面の高さで決める */}
      <motion.div
        aria-hidden={formation.cardsHidden || undefined}
        initial={false}
        animate={{ y: formation.cardsHidden ? "45vh" : "0vh" }}
        transition={
          formation.cardsHidden
            ? { duration: seconds(380), ease: [0.7, 0, 0.84, 0] }
            : { duration: seconds(480), ease: [0.34, 1.3, 0.64, 1] }
        }
        style={{
          ...REVERT,
          position: "absolute",
          inset: 0,
          pointerEvents: formation.cardsHidden ? "none" : undefined,
        }}
      >
        {state.party.map((id, index) => (
          <Card
            key={`${id}-${wide}`}
            index={index}
            id={id}
            wide={wide}
            entered={entered}
          />
        ))}
      </motion.div>
    </div>
  )
}

export { FormationContext, useFormation, type TargetRequest } from "./context"
