import { Card } from "@/client/components/ui/card"
import { artworkReferenceStyle } from "@/client/components/dev/artwork-reference-style"
import { useArtworkGridColumns } from "@/client/components/dev/use-artwork-grid-columns"
import { useArtworkVersion } from "@/client/components/dev/use-artwork-version"

export type PortraitEntry = {
  key: string
  name: string
  image?: string
}

type Props = {
  title: string
  entries: PortraitEntry[]
}

export function OutfitGallery(props: Props) {
  const gridColumns = useArtworkGridColumns()
  const { version } = useArtworkVersion()
  return (
    <section
      aria-label={props.title}
      style={{ gridColumn: "1 / -1", marginTop: 24 }}
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
        {props.entries.map((entry) => (
          <figure key={entry.key}>
            <Card className="p-0">
              <div style={{ aspectRatio: "3 / 4" }}>
                {entry.image ? (
                  <a
                    href={entry.image}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={entry.name + "の画像を開く"}
                  >
                    <img
                      src={entry.image}
                      alt={entry.name}
                      loading="lazy"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        ...artworkReferenceStyle(entry.image, version),
                      }}
                    />
                  </a>
                ) : (
                  <span style={{ display: "block", padding: 16 }}>
                    画像未登録
                  </span>
                )}
              </div>
            </Card>
            <figcaption style={{ marginTop: 8 }}>{entry.name}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
