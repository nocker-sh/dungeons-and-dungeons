import { Card } from "@/client/components/ui/card"
import { CardContent } from "@/client/components/ui/card-content"
import { outfitImage } from "@/concept/outfits"
import { equipmentCharacters } from "@/development/equipment-characters"
import type { CatalogGood } from "@/development/goods"
import { OutfitGallery } from "@/client/components/dev/outfit-gallery"

/** 装備側からも、装備できる人物を確認する。防具は着用姿、武器は名前だけを並べる。 */
type Props = { good: CatalogGood }

export function EquipmentCharacters(props: Props) {
  const characters = equipmentCharacters(props.good.id)
  if (!characters.length) return null
  if (props.good.kind !== "armor") {
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
        image: outfitImage(character.look, props.good.id),
      }))}
    />
  )
}
