import type { ConceptEntry } from "@/concept/database"
import { characterArtworkVersion } from "@/development/character-artwork-version"
import { useArtworkVersion } from "@/development/components/use-artwork-version"
import { useArtworkGridColumns } from "@/development/components/use-artwork-grid-columns"
import { PortraitFigure } from "@/development/components/portrait-figure"

type Props = {
  entries: readonly ConceptEntry[]
  onEntryChange: (slug: string) => void
}

export function CharacterGallery(props: Props) {
  const { version } = useArtworkVersion()
  const gridColumns = useArtworkGridColumns()
  return (
    <div style={{ display: "grid", gap: 32 }}>
      {["N", "R", "SR"].map((rarity) => (
        <section key={rarity} aria-label={`${rarity}のキャラ`}>
          <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>
            {rarity}
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: gridColumns,
              gap: 24,
            }}
          >
            {props.entries
              .filter((entry) => entry.rarity === rarity)
              .map((entry) => (
                <a
                  key={entry.id}
                  href={`/characters/${entry.slug}`}
                  style={{ textAlign: "left", cursor: "pointer", minWidth: 0 }}
                  onClick={(event) => {
                    event.preventDefault()
                    props.onEntryChange(entry.slug)
                  }}
                >
                  <PortraitFigure
                    name={entry.name}
                    label={entry.name}
                    image={characterArtworkVersion(entry, version).image}
                  />
                </a>
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}
