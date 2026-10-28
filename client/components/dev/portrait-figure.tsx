import { useArtworkReferenceStyle } from "@/client/components/dev/use-artwork-reference-style"
import { Card } from "@/client/components/ui/card"

type Props = {
  name: string
  label: string
  image?: string | null
}

export function PortraitFigure(props: Props) {
  const referenceStyle = useArtworkReferenceStyle(props.image)
  return (
    <figure>
      <Card className="p-0">
        <div
          style={{ aspectRatio: "3 / 4" }}
          aria-label={`${props.name}・${props.label}${props.image ? "" : "（未登録）"}`}
        >
          {props.image ? (
            <img
              src={props.image}
              alt={`${props.name}・${props.label}`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                ...referenceStyle,
              }}
            />
          ) : (
            <span style={{ display: "block", padding: 16 }}>未登録</span>
          )}
        </div>
      </Card>
      <figcaption style={{ marginTop: 8 }}>{props.label}</figcaption>
    </figure>
  )
}
