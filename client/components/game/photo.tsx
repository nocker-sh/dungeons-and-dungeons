import { PALETTE, REVERT, unit } from "@/client/components/canvas/tokens"
import { PhotoImage } from "@/client/components/game/photo-image"

/** 手札の写真一枚。白い縁の付いた写真。 */
type Props = { look: string }

export function Photo(props: Props) {
  return (
    <span
      style={{
        ...REVERT,
        display: "block",
        padding: unit(0.6),
        paddingBottom: unit(1.6),
        background: "#fff",
        boxShadow: `0 0 0 1px ${PALETTE.stone}, ${unit(0.6)} ${unit(0.6)} 0 ${PALETTE.ink}`,
      }}
    >
      <span
        style={{
          ...REVERT,
          display: "block",
          aspectRatio: "3 / 4",
          overflow: "hidden",
        }}
      >
        <PhotoImage look={props.look} />
      </span>
    </span>
  )
}
