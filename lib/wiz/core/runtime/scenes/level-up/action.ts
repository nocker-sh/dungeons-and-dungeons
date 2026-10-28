import type { WizAttributeKey } from "@/lib/wiz/core/types"

export type WizSceneLevelUpAction =
  | Readonly<{ type: "ALLOCATE_ATTRIBUTE"; attribute: WizAttributeKey }>
  | Readonly<{ type: "RESET_PENDING_ATTRIBUTES" }>
  | Readonly<{ type: "CONFIRM_LEVEL_UP" }>
