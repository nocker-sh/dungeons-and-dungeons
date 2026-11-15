import { useArtworkGridColumns } from "@/development/components/use-artwork-grid-columns"
import type { PortraitState } from "@/concept/portrait-types"
import { PortraitFigure } from "@/development/components/portrait-figure"

type Props = {
  title: string
  name: string
  states: readonly { value: PortraitState; label: string }[]
  images?: Partial<Record<PortraitState, string | null>>
  rearImage?: string | null
  rearLookImage?: string | null
}

export function PortraitSection(props: Props) {
  const gridColumns = useArtworkGridColumns()
  return (
    <section
      style={{ gridColumn: "1 / -1" }}
      aria-label={`${props.title}立ち絵`}
    >
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
        {props.title}
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: gridColumns,
          gap: 24,
        }}
      >
        {props.rearImage !== undefined ? (
          <PortraitFigure
            name={props.name}
            label="後ろ姿（敵の方を向く）"
            image={props.rearImage}
          />
        ) : null}
        {props.rearLookImage !== undefined ? (
          <PortraitFigure
            name={props.name}
            label="振り返り（こちらを見る）"
            image={props.rearLookImage}
          />
        ) : null}
        {props.states.map((state) => (
          <PortraitFigure
            key={state.value}
            name={props.name}
            label={state.value === "talk" ? "会話" : state.label}
            image={props.images?.[state.value]}
          />
        ))}
      </div>
    </section>
  )
}
