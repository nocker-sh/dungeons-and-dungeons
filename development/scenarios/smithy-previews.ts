import { shopLook } from "@/content/looks/shop-look"
import { street } from "@/content/looks/street"
import type { PreviewStart } from "@/client/dev/preview-start"
import type { Preview } from "@/development/scenarios/types"
import type { PreviewContext } from "@/development/scenarios/context"
import type { createEquipmentScenarios } from "@/development/scenarios/equipment"
import type { createArmorScenarios } from "@/development/scenarios/armor"

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
