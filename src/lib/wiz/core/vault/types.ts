import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import type {
  WizEquipmentLoadoutState,
  WizInventoryEntryDefinition,
  WizInventoryState,
} from "@/lib/wiz/core/domain/values/inventory"
import type { WizLogMessage } from "@/lib/wiz/core/types/wiz-log-message"
import type { WizVaultAreaState } from "@/lib/wiz/core/vault/states/area/schema"
import type { WizVaultNpc } from "@/lib/wiz/core/vault/states/npc/type"
import type {
  WizVaultPartyMemberState,
  WizVaultPlayerState,
} from "@/lib/wiz/core/vault/states/player/schema"
import type { WizVaultQuestState } from "@/lib/wiz/core/vault/states/quest/schema"
import type { WizVaultTimeState } from "@/lib/wiz/core/vault/states/time/schema"

export type WizStandardInventoryContentType = "armor" | "item" | "weapon"
export type WizStandardInventoryEntryState = WizInventoryEntryDefinition<
  string,
  WizStandardInventoryContentType,
  string,
  unknown
>
export type WizStandardInventoryState = WizInventoryState<WizStandardInventoryEntryState>
export type WizStandardEquipmentState = WizEquipmentLoadoutState<string, string>

export type WizVaultObject = {
  readonly player: WizDeepReadonly<WizVaultPlayerState>
  readonly partyMembers: readonly WizDeepReadonly<WizVaultPartyMemberState>[]
  readonly inventory: WizDeepReadonly<WizStandardInventoryState>
  readonly equipment: WizDeepReadonly<WizStandardEquipmentState>
  readonly time: WizDeepReadonly<WizVaultTimeState>
  readonly areas: readonly WizDeepReadonly<WizVaultAreaState>[]
  readonly npcs: readonly WizDeepReadonly<WizVaultNpc>[]
  readonly quests: readonly WizDeepReadonly<WizVaultQuestState>[]
  readonly flags: readonly string[]
  readonly log: readonly WizDeepReadonly<WizLogMessage>[]
  readonly unlockedFacilities: readonly string[]
  readonly isEnded: boolean
}
