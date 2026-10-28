import { useArtworkVersion } from "@/client/components/dev/use-artwork-version"
import { useArtworkGridColumns } from "@/client/components/dev/use-artwork-grid-columns"
import type { ConceptCharacter } from "@/concept/characters"
import type { PortraitState } from "@/concept/portrait-types"
import { PortraitFigure } from "@/client/components/dev/portrait-figure"

type Props = {
  title: string
  name: string
  states: readonly { value: PortraitState; label: string }[]
  images?: Partial<Record<PortraitState, string | null>>
  versions?: ConceptCharacter["bustPortraitVersions"]
  versioned: boolean
  rearImage?: string | null
  rearLookImage?: string | null
}

export function PortraitSection(props: Props) {
  const { version } = useArtworkVersion()
  const gridColumns = useArtworkGridColumns()
  const portraitVersion = props.versions?.find(
    (entry) => entry.version === version
  )
  const displayedRearImage =
    version === "v0"
      ? props.rearImage
      : (portraitVersion?.battleRearPortrait ?? props.rearImage)
  const displayedRearLookImage =
    version === "v0"
      ? props.rearLookImage
      : (portraitVersion?.battleRearLookPortrait ?? props.rearLookImage)
  const displayedImages:
    | Partial<Record<PortraitState, string | null>>
    | undefined =
    !props.versioned || version === "v0"
      ? props.images
      : {
          ...props.images,
          ...props.versions?.find((entry) => entry.version === version)
            ?.portraits,
        }
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
        {props.rearImage ? (
          <PortraitFigure
            name={props.name}
            label="後ろ姿（敵の方を向く）"
            image={displayedRearImage}
          />
        ) : null}
        {props.rearImage || props.rearLookImage || displayedRearLookImage ? (
          <PortraitFigure
            name={props.name}
            label="振り返り（こちらを見る）"
            image={displayedRearLookImage}
          />
        ) : null}
        {props.states.map((state) => (
          <PortraitFigure
            key={state.value}
            name={props.name}
            label={state.value === "talk" ? "会話" : state.label}
            image={displayedImages?.[state.value]}
          />
        ))}
      </div>
    </section>
  )
}
