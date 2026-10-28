import { outfitImage } from "@/concept/outfits"
import { wearableArmor } from "@/development/wearable-armor"
import { OutfitGallery } from "@/client/components/dev/outfit-gallery"

/** 仲間の装備条件と、主人公の見た目用衣装に合わせて並べる。 */
type Props = {
  member: string
  look: string
}

export function OutfitPreview(props: Props) {
  const armor = wearableArmor(props.member, props.look)
  if (!armor.length) return null
  return (
    <OutfitGallery
      title="着替え"
      entries={armor.map((good) => ({
        key: good.id,
        name: good.name,
        image: outfitImage(props.look, good.id),
      }))}
    />
  )
}
