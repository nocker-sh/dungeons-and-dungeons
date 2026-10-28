import type { WizContentArea } from "@/lib/wiz/core/definition/area/area"
import type { WizContentArmor } from "@/lib/wiz/core/definition/equipment/armor"
import type { WizContentWeapon } from "@/lib/wiz/core/definition/equipment/weapon"
import type { WizContentItem } from "@/lib/wiz/core/definition/item/item"
import type { WizContentMonster } from "@/lib/wiz/core/definition/monster/monster"
import type { WizContentNpc } from "@/lib/wiz/core/definition/npc/npc"
import type { WizContentRecipe } from "@/lib/wiz/core/definition/recipe/recipe"
import { getWizImmutableRecordValue } from "@/lib/wiz/core/get-wiz-immutable-record-value"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"

type WizRuntimeContentRecord<TEntry extends { readonly id: string }> = Readonly<
  Partial<Record<string, WizDeepReadonly<TEntry>>>
>

/**
 * runtime が静的 content から読み取る最小契約。
 *
 * content layer の具象 class ではなく、immutable な構造だけに依存させる。
 */
export type WizRuntimeContentView = Readonly<{
  items: WizRuntimeContentRecord<WizContentItem>
  weapons: WizRuntimeContentRecord<WizContentWeapon>
  armors: WizRuntimeContentRecord<WizContentArmor>
  recipes: WizRuntimeContentRecord<WizContentRecipe>
  monsters: WizRuntimeContentRecord<WizContentMonster>
  areas: WizRuntimeContentRecord<WizContentArea>
  npcs: WizRuntimeContentRecord<WizContentNpc>
}>

export const getWizRuntimeContentEntry = <
  TEntry extends { readonly id: string },
>(
  record: WizRuntimeContentRecord<TEntry>,
  id: string
): WizDeepReadonly<TEntry> | undefined => getWizImmutableRecordValue(record, id)
