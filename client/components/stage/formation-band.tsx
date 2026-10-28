import type { ReactNode } from "react"
import { motion } from "motion/react"
import { seconds } from "@/client/components/stage/seconds"
import { REVERT, STAGE_LAYER } from "@/client/components/canvas/tokens"
import type { FormationShow } from "@/client/components/stage/director"
import { formationHeight } from "@/client/components/stage/formation-height"

/** 下の隊列の帯。見せ方（StageDirector が決める）に合わせて下げる・畳む。 */
export type Props = {
  show: FormationShow
  wide: boolean
  children: ReactNode
}

export function FormationBand(props: Props) {
  const folded = props.show === "folded" || props.show === "gone"
  const gone = props.show === "gone"
  // 引っ込めるときは加速して落とし、戻すときは少し弾ませる
  const transition = {
    duration: seconds(props.show === "shown" ? 480 : 380),
    ease:
      props.show === "shown"
        ? ([0.34, 1.1, 0.64, 1] as const)
        : ([0.7, 0, 0.84, 0] as const),
  }
  return (
    <motion.nav
      className="formation"
      aria-label="隊列"
      aria-hidden={gone || undefined}
      inert={gone}
      initial={false}
      animate={{
        height: folded ? "0vh" : formationHeight(props.wide),
        y: props.show === "lowered" ? "110%" : "0%",
        // 札は帯の外へはみ出して描くので、何も見せないときは畳み終えてから消す
        ...(gone
          ? { transitionEnd: { visibility: "hidden" as const } }
          : { visibility: "visible" as const }),
      }}
      transition={transition}
      style={{
        ...REVERT,
        display: "block",
        position: "relative",
        zIndex: STAGE_LAYER.formation,
      }}
    >
      {props.children}
    </motion.nav>
  )
}
