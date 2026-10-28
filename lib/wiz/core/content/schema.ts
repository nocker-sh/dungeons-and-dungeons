import { z } from "zod"
import {
  type WizContentArea,
  zWizContentArea,
} from "@/lib/wiz/core/definition/area/area"
import {
  type WizContentArmor,
  zWizContentArmor,
} from "@/lib/wiz/core/definition/equipment/armor"
import {
  type WizContentWeapon,
  zWizContentWeapon,
} from "@/lib/wiz/core/definition/equipment/weapon"
import {
  type WizContentEvent,
  zWizContentEvent,
} from "@/lib/wiz/core/definition/event/event"
import {
  type WizContentFacilityUnlockCondition,
  zWizContentFacilityTable,
} from "@/lib/wiz/core/definition/facility/facility-table"
import {
  type WizContentItem,
  zWizContentItem,
} from "@/lib/wiz/core/definition/item/item"
import {
  type WizContentInnPlan,
  zWizContentInnPlan,
} from "@/lib/wiz/core/definition/inn/inn-plan"
import {
  type WizContentMonster,
  zWizContentMonster,
} from "@/lib/wiz/core/definition/monster/monster"
import {
  type WizContentNpc,
  zWizContentNpc,
} from "@/lib/wiz/core/definition/npc/npc"
import type { WizContentQuest } from "@/lib/wiz/core/definition/quest/quest"
import { zWizContentQuest } from "@/lib/wiz/core/definition/quest/quest"
import {
  type WizContentRecipe,
  zWizContentRecipe,
} from "@/lib/wiz/core/definition/recipe/recipe"
import {
  type WizContentShopDialogue,
  zWizContentShopDialogues,
} from "@/lib/wiz/core/definition/shop/dialogue"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import {
  type WizBattleAbilityDefinition,
  zWizBattleAbilityDefinition,
} from "@/lib/wiz/core/engine/battle/ability"

export const zWorldAbilityTableEntry = z.strictObject({
  abilityId: z.string(),
  requiredLevel: z.number().finite().int().positive(),
})

export type WorldAbilityTableEntry = z.infer<typeof zWorldAbilityTableEntry>

/**
 * 静的 World Content の標準入力。
 *
 * 使わないcategoryはすべて省略でき、parse 後は空配列に正規化される。
 */
export const zWorldContentArrays = z.strictObject({
  items: z.array(zWizContentItem).default([]),
  weapons: z.array(zWizContentWeapon).default([]),
  armors: z.array(zWizContentArmor).default([]),
  recipes: z.array(zWizContentRecipe).default([]),
  monsters: z.array(zWizContentMonster).default([]),
  events: z.array(zWizContentEvent).default([]),
  areas: z.array(zWizContentArea).default([]),
  npcs: z.array(zWizContentNpc).default([]),
  quests: z.array(zWizContentQuest).default([]),
  facilities: zWizContentFacilityTable.default([]),
  abilities: z.array(zWizBattleAbilityDefinition).default([]),
  shopDialogues: zWizContentShopDialogues.default([]),
  abilityTable: z.array(zWorldAbilityTableEntry).default([]),
  innPlans: z.array(zWizContentInnPlan).default([]),
})

export type WorldContentArrays = {
  readonly items: readonly WizDeepReadonly<WizContentItem>[]
  readonly weapons: readonly WizDeepReadonly<WizContentWeapon>[]
  readonly armors: readonly WizDeepReadonly<WizContentArmor>[]
  readonly recipes: readonly WizDeepReadonly<WizContentRecipe>[]
  readonly monsters: readonly WizDeepReadonly<WizContentMonster>[]
  readonly events: readonly WizDeepReadonly<WizContentEvent>[]
  readonly areas: readonly WizDeepReadonly<WizContentArea>[]
  readonly npcs: readonly WizDeepReadonly<WizContentNpc>[]
  readonly quests: readonly WizDeepReadonly<WizContentQuest>[]
  readonly facilities: readonly WizDeepReadonly<WizContentFacilityUnlockCondition>[]
  readonly abilities: readonly WizBattleAbilityDefinition[]
  readonly shopDialogues: readonly WizDeepReadonly<WizContentShopDialogue>[]
  readonly abilityTable: readonly WizDeepReadonly<WorldAbilityTableEntry>[]
  readonly innPlans: readonly WizDeepReadonly<WizContentInnPlan>[]
}

export type WorldContentArraysInput = {
  readonly [TKey in keyof WorldContentArrays]?: WorldContentArrays[TKey]
}

type NormalizedWorldContentCategory<
  TInput extends object,
  TKey extends keyof WorldContentArrays,
> = TKey extends keyof TInput
  ? NonNullable<TInput[TKey]> extends WorldContentArrays[TKey]
    ? NonNullable<TInput[TKey]>
    : readonly []
  : readonly []

export type NormalizeWorldContentArrays<TInput extends object> = Omit<
  TInput,
  keyof WorldContentArrays
> & {
  readonly [TKey in keyof WorldContentArrays]-?: NormalizedWorldContentCategory<
    TInput,
    TKey
  >
}
