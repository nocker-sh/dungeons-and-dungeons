import "@/client/components/game/formation/card-shared"
import { motion } from "motion/react"
import { TornLabel } from "@/client/components/canvas/torn-label"
import { PALETTE, REVERT, unit } from "@/client/components/canvas/tokens"

/** 対象に選べる仲間の上で揺れる「これ」と三角。 */
export function AimCursor() {
  return (
    <motion.div
      className="aim"
      aria-hidden="true"
      animate={{ y: ["0%", "20%", "0%"] }}
      transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity }}
      style={{
        ...REVERT,
        position: "absolute",
        left: "50%",
        top: 0,
        zIndex: 5,
        translate: "-50% -100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      <TornLabel
        background={PALETTE.paper}
        color={PALETTE.ink}
        clip="polygon(4% 0, 100% 6%, 96% 100%, 0 92%)"
        style={{
          padding: "0.05em 0.5em",
          fontSize: unit(3),
          fontWeight: "bold",
        }}
      >
        これ
      </TornLabel>
      <i
        style={{
          ...REVERT,
          width: unit(3.6),
          height: unit(2.6),
          background: PALETTE.paper,
          clipPath: "polygon(0 0, 100% 0, 50% 100%)",
        }}
      />
    </motion.div>
  )
}
