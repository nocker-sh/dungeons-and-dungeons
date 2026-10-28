import type { WorldContentArrays } from "@/lib/wiz/core/content/schema"
import type { WorldContent } from "@/lib/wiz/core/content/world-content"
import { WizEngineBattleContent } from "@/lib/wiz/core/engine/battle/content"
import { isBattleUsableItemDefinition } from "@/lib/wiz/core/engine/battle/is-battle-usable-item-definition"

/** @internal */
export const createWizStandardBattleContent = <
  TArrays extends WorldContentArrays,
>(
  content: WorldContent<TArrays>
): WizEngineBattleContent =>
  new WizEngineBattleContent({
    abilities: content.abilities,
    items: Object.fromEntries(
      content.arrays.items.flatMap((item) =>
        isBattleUsableItemDefinition(item) ? [[item.id, item] as const] : []
      )
    ),
  })
