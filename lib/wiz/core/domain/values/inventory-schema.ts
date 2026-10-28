import { z } from "zod"
import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import type { WizEquipmentLoadoutState } from "@/lib/wiz/core/domain/values/inventory"
import {
  createWizInventoryEntryStateSchema,
  semanticId,
} from "@/lib/wiz/core/domain/values/create-wiz-inventory-entry-state-schema"
import { createWizInventoryStateSchema } from "@/lib/wiz/core/domain/values/create-wiz-inventory-state-schema"

export const WizInventoryEntryStateSchema =
  createWizInventoryEntryStateSchema(semanticId)

export const WizInventoryStateSchema = createWizInventoryStateSchema(semanticId)

export const WizEquipmentLoadoutStateSchema = z.record(
  semanticId,
  semanticId.nullable()
) satisfies z.ZodType<WizEquipmentLoadoutState>

export type WizInventoryEntryState = WizDeepReadonly<
  z.infer<typeof WizInventoryEntryStateSchema>
>
