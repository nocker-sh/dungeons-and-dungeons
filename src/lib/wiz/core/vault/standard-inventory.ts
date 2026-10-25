import { z } from "zod"
import {
  createWizInventoryStateSchema,
  WizEquipmentLoadoutStateSchema,
} from "@/lib/wiz/core/domain/values/inventory-schema"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import type {
  WizStandardEquipmentState,
  WizStandardInventoryState,
} from "@/lib/wiz/core/vault/types"

const standardInventoryOwnership = new WizObjectService()

export const WizStandardInventoryStateSchema = createWizInventoryStateSchema(
  z.enum(["armor", "item", "weapon"]),
) satisfies z.ZodType<WizStandardInventoryState>

export const WizStandardEquipmentStateSchema =
  WizEquipmentLoadoutStateSchema satisfies z.ZodType<WizStandardEquipmentState>

export const WIZ_STANDARD_DEFAULT_INVENTORY: WizStandardInventoryState =
  standardInventoryOwnership.ownImmutable({
    capacity: 20,
    entries: [],
  })

export const WIZ_STANDARD_DEFAULT_EQUIPMENT: WizStandardEquipmentState =
  standardInventoryOwnership.ownImmutable({})
