import { immutableConfig } from "@/lib/wiz/core/config/immutable-config"

export type WizAffinityLevelDefinition<TId extends string = string> = Readonly<{
  readonly id: TId
  readonly minimum: number
}>

export type WizAffinityDefinition<TId extends string = string> = Readonly<{
  readonly minimum: number
  readonly maximum: number
  readonly levels: readonly WizAffinityLevelDefinition<TId>[]
}>

export type WizConversationConfig = {
  readonly affinity: WizAffinityDefinition
  readonly dialogueAffinityBonus: number
}

export const WIZ_STANDARD_AFFINITY_LEVELS = immutableConfig([
  { id: "stranger", minimum: 0 },
  { id: "acquaintance", minimum: 20 },
  { id: "friend", minimum: 50 },
  { id: "close_friend", minimum: 80 },
  { id: "best_friend", minimum: 100 },
] as const)

export type WizStandardAffinityLevel = (typeof WIZ_STANDARD_AFFINITY_LEVELS)[number]["id"]

export const WIZ_STANDARD_AFFINITY_DEFINITION = immutableConfig({
  minimum: 0,
  maximum: 100,
  levels: WIZ_STANDARD_AFFINITY_LEVELS,
}) satisfies WizAffinityDefinition<WizStandardAffinityLevel>

export const DEFAULT_CONVERSATION_CONFIG: WizConversationConfig = immutableConfig({
  affinity: WIZ_STANDARD_AFFINITY_DEFINITION,
  dialogueAffinityBonus: 1,
})
