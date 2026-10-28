import type { WizLogMessage } from "@/lib/wiz/core/types/wiz-log-message"

export type WizSystemAction =
  | Readonly<{ type: "ADD_LOG"; message: WizLogMessage }>
  | Readonly<{ type: "ADVANCE_TIME" }>
  | Readonly<{ type: "NEW_DAY" }>
  | Readonly<{ type: "WORLD_ENDED" }>
  | Readonly<{ type: "WORLD_RESET" }>
