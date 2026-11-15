import { PALETTE } from "@/client/components/canvas/tokens"
import { goodImage } from "@/concept/goods-art"
import { CanvasImage } from "@/client/components/canvas/canvas-image"
import { Svg } from "@/client/components/game/svg"
import { iconOf } from "@/client/components/game/icon-of"

/** 品物の絵があるときは使い、依頼や部屋などは既存の記号を保つ。 */
export type Props = {
  id: string
  iconSize?: string
  image?: string
}

export function GoodIcon(props: Props) {
  const iconSize = props.iconSize === undefined ? "56%" : props.iconSize

  const image = props.image ?? goodImage(props.id)
  return image ? (
    <CanvasImage
      src={image}
      alt=""
      style={{
        width: "90%",
        height: "90%",
        objectFit: "contain",
        display: "block",
        background: PALETTE.paper,
      }}
    />
  ) : (
    <Svg
      html={iconOf(props.id)}
      style={{ width: iconSize, height: iconSize, display: "block" }}
    />
  )
}
