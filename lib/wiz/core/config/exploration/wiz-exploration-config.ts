import { immutableConfig } from "@/lib/wiz/core/config/immutable-config"

export type WizExplorationActionType = "explore" | "gather" | "hunt" | "rest" | "return"

export const DEFAULT_EXPLORATION_ACTIONS: readonly WizExplorationActionType[] = immutableConfig([
  "explore",
  "gather",
  "hunt",
  "rest",
  "return",
])
