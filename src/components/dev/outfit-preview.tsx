import { Card, CardContent } from "@/components/ui/card"
import { outfitImage } from "@/lib/concept/outfits"
import { equipmentCharacters, wearableArmor } from "@/lib/dev/outfits"
import type { CatalogGood } from "@/lib/dev/goods"
import { useArtworkGridColumns, useArtworkVersion } from "./artwork-version"

type PortraitEntry = {
  key: string
  name: string
  image?: string
}

function OutfitGallery({
  title,
  entries,
}: {
  title: string
  entries: PortraitEntry[]
}) {
  const gridColumns = useArtworkGridColumns()
  const { version } = useArtworkVersion()
  return (
    <section aria-label={title} style={{ gridColumn: "1 / -1", marginTop: 24 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>
        {title}
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: gridColumns,
          gap: 24,
        }}
      >
        {entries.map((entry) => (
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
                        ...(version === "v1" &&
                        !entry.image.startsWith("/images/styles/v1/")
                          ? { opacity: 0.35, filter: "saturate(0.35)" }
                          : {}),
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

/** 仲間の装備条件と、主人公の見た目用衣装に合わせて並べる。 */
export function OutfitPreview({
  member,
  look,
}: {
  member: string
  look: string
}) {
  const armor = wearableArmor(member, look)
  if (!armor.length) return null
  return (
    <OutfitGallery
      title="着替え"
      entries={armor.map((good) => ({
        key: good.id,
        name: good.name,
        image: outfitImage(look, good.id),
      }))}
    />
  )
}

/** 装備側からも、装備できる人物を確認する。防具は着用姿、武器は名前だけを並べる。 */
export function EquipmentCharacters({ good }: { good: CatalogGood }) {
  const characters = equipmentCharacters(good.id)
  if (!characters.length) return null
  if (good.kind !== "armor") {
    return (
      <section aria-label="装備できるキャラ" style={{ marginTop: 24 }}>
        <Card>
          <CardContent>
            <h2 style={{ fontWeight: 600, marginBottom: 12 }}>
              装備できるキャラ
            </h2>
            <ul style={{ display: "grid", gap: 8 }}>
              {characters.map((character) => (
                <li key={character.look}>
                  <a
                    href={character.href}
                    className="underline underline-offset-4"
                  >
                    {character.name}
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>
    )
  }
  return (
    <OutfitGallery
      title="着用するキャラ"
      entries={characters.map((character) => ({
        key: character.look,
        name: character.name,
        image: outfitImage(character.look, good.id),
      }))}
    />
  )
}
