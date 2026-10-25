import { contentSource } from "@/lib/content/game-content"
import { placeSlug, shopLook, street } from "@/lib/content/looks"

import type { PreviewStart } from "@/lib/game-client/start"

import type { Preview } from "./types"
import type { PreviewContext } from "./context"
import type { createEquipmentScenarios } from "./equipment"
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

import type { createArmorScenarios } from "./armor"
export function smithyPreviews(
  context: PreviewContext,
  armor: Pick<ReturnType<typeof createArmorScenarios>, "armoredTown">,
  equipment: Pick<ReturnType<typeof createEquipmentScenarios>, "uniqueTown">
): Preview[] {
  const { prepared } = context
  const { armoredTown } = armor
  const { uniqueTown } = equipment

  return [
    {
      slug: "smithy-repair",
      title: "鍛冶屋：防具の修理",
      start: (): PreviewStart => {
        const smithy = street().find((id) => shopLook(id).kind === "smithy")
        if (!smithy) throw new Error("鍛冶屋がない")
        return prepared(armoredTown(), { name: "shop", shop: smithy })
      },
    },
    {
      slug: "smithy-repair-named",
      title: "鍛冶屋：登録した主人公の名前",
      start: (): PreviewStart => {
        const smithy = street().find((id) => shopLook(id).kind === "smithy")
        if (!smithy) throw new Error("鍛冶屋がない")
        const game = armoredTown()
        const saved = game.save()
        const failed = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            hero: { ...saved.snapshot.hero, name: "コハク" },
          },
        })
        if (failed) throw failed
        return prepared(game, { name: "shop", shop: smithy })
      },
    },
    {
      slug: "smithy-reforge",
      title: "鍛冶屋：固有の武器の鍛え直し",
      start: (): PreviewStart => {
        const smithy = street().find((id) => shopLook(id).kind === "smithy")
        if (!smithy) throw new Error("鍛冶屋がない")
        return prepared(uniqueTown(), { name: "shop", shop: smithy })
      },
    },
  ]
}
