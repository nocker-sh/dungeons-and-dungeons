import { IMG_BASE, PALETTE } from "@/client/components/canvas/tokens"
import { frameOf } from "@/content/looks/frame-of"

/** 写真の絵。上半身の絵の顔のあたりを写す。 */
type Props = { look: string }

export function PhotoImage(props: Props) {
  const frame = frameOf(props.look)
  return (
    <img
      src={frame.bust ?? frame.img}
      alt=""
      draggable={false}
      style={{
        ...IMG_BASE,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: "50% 0%",
        background: PALETTE.mist,
      }}
    />
  )
}
