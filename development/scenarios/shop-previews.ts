import { contentSource } from "@/content/game-content"
import { placeSlug } from "@/content/looks/place-slug"
import { shopLook } from "@/content/looks/shop-look"
import { street } from "@/content/looks/street"
import type { PreviewStart } from "@/client/dev/preview-start"
import type { Preview } from "@/development/scenarios/types"
import type { PreviewContext } from "@/development/scenarios/context"
import type { createEquipmentScenarios } from "@/development/scenarios/equipment"

export function shopPreviews(
  context: PreviewContext,
  equipment: Pick<
    ReturnType<typeof createEquipmentScenarios>,
    "withJunk" | "armorJunk"
  >
): Preview[] {
  const { content, play, prepared } = context
  const { withJunk, armorJunk } = equipment
  const shops = street().flatMap((id) => {
    const slug = placeSlug(shopLook(id).place).replace(/^place-/, "shop-")
    const appraises = !!content.shops.find((shop) => shop.id === id)?.appraise
      ?.length
    return [
      {
        slug,
        title: `店：${shopLook(id).name}`,
        start: (): PreviewStart =>
          prepared(play(1), { name: "shop", shop: id }),
      },
      ...(appraises
        ? [
            {
              slug: `${slug}-junk`,
              title: `店：${shopLook(id).name}（ガラクタ8個）`,
              start: (): PreviewStart =>
                prepared(withJunk(), { name: "shop", shop: id }),
            },
            {
              slug: `${slug}-junk-late`,
              title: `店：${shopLook(id).name}（最深層到達・ガラクタ8個）`,
              start: (): PreviewStart =>
                prepared(withJunk(1, 4), { name: "shop", shop: id }),
            },
          ]
        : []),
    ]
  })
  const armorShop = content.shops.find((entry) =>
    entry.appraise?.some(
      (id) => content.goods.find((good) => good.id === id)?.kind === "armor"
    )
  )
  if (armorShop)
    shops.push({
      slug: "shop-appraise-armor",
      title: "鑑定：防具の発見",
      start: (): PreviewStart =>
        prepared(armorJunk(armorShop.id), { name: "shop", shop: armorShop.id }),
    })
  const rooms = contentSource.rooms.map((room) => ({
    slug: `room-${room.slug}`,
    title: `宿の部屋：${room.name}`,
    start: (): PreviewStart =>
      prepared(play(1), { name: "room", room: room.id }),
  }))

  return [...shops, ...rooms]
}
