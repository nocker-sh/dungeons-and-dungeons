import { motion } from "motion/react"
import { PALETTE, REVERT, unit } from "@/client/components/canvas/tokens"
import { personOf } from "@/content/looks/person-of"
import { photoLayoutId } from "@/client/components/game/guild-registration-shared"
import { PhotoImage } from "@/client/components/game/photo-image"

/** 用紙の写真欄。選んだ写真が貼られる。 */
type Props = { look: string }

export function PhotoSlot(props: Props) {
  return (
    <div
      aria-label={`貼った写真 ${personOf(props.look)?.name ?? props.look}`}
      role="img"
      style={{
        ...REVERT,
        display: "block",
        position: "relative",
        width: `clamp(96px, ${unit(24)}, 200px)`,
        aspectRatio: "3 / 4",
        border: `2px dashed ${PALETTE.stone}`,
        background: PALETTE.mist,
      }}
    >
      <motion.div
        key={props.look}
        layoutId={photoLayoutId(props.look)}
        initial={false}
        animate={{ rotate: 2 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        style={{
          ...REVERT,
          display: "block",
          position: "absolute",
          inset: 3,
          overflow: "hidden",
          boxShadow: `0 0 0 2px ${PALETTE.ink}`,
        }}
      >
        <PhotoImage look={props.look} />
      </motion.div>
    </div>
  )
}
