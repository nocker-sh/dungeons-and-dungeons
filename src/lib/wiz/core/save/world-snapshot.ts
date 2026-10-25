import { z } from "zod"
import {
  WIZ_IMMUTABLE_VALUE,
  type WizDeepReadonly,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import type { WizLogMessage } from "@/lib/wiz/core/types/wiz-log-message"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import { zWizLogMessage, zWizVault } from "@/lib/wiz/core/vault/schema"
import { WizVaultAreaStateSchema } from "@/lib/wiz/core/vault/states/area/schema"
import {
  WizStandardEquipmentStateSchema,
  WizStandardInventoryStateSchema,
} from "@/lib/wiz/core/vault/standard-inventory"
import { WizVaultNpcSchema } from "@/lib/wiz/core/vault/states/npc/schema"
import {
  WizVaultPartyMemberStateSchema,
  WizVaultPlayerStateSchema,
  type WizVaultPartyMemberState,
  type WizVaultPlayerState,
} from "@/lib/wiz/core/vault/states/player/schema"
import {
  zWizVaultNonnegativeNumber,
  zWizVaultSemanticId,
} from "@/lib/wiz/core/vault/states/schema-values"
import { zWizVaultTimeState, type WizVaultTimeState } from "@/lib/wiz/core/vault/states/time/schema"
import type {
  WizStandardEquipmentState,
  WizStandardInventoryState,
  WizVaultObject,
} from "@/lib/wiz/core/vault/types"
import { WizVaultValue } from "@/lib/wiz/core/vault/value"

const objectService = new WizObjectService()
const worldSnapshotConstructorToken = Symbol("WorldSnapshot.constructor")
const authenticWorldSnapshots = new WeakSet<object>()

export type WorldSnapshotAreaState = {
  readonly id: string
  readonly progress: number
  readonly unlocked: boolean
}

export type WorldSnapshotNpcState = {
  readonly id: string
  readonly affinity: number
}

export type WorldSnapshotQuestState = {
  readonly id: string
  readonly accepted: boolean
  readonly completed: boolean
  readonly progress?: number
}

export type WorldSnapshotEquipmentState = WizDeepReadonly<WizStandardEquipmentState>

export type WorldSnapshotData = {
  readonly player: WizDeepReadonly<WizVaultPlayerState>
  readonly partyMembers: readonly WizDeepReadonly<WizVaultPartyMemberState>[]
  readonly inventory: WizDeepReadonly<WizStandardInventoryState>
  readonly equipment: WorldSnapshotEquipmentState
  readonly time: WizDeepReadonly<WizVaultTimeState>
  readonly areas: readonly WorldSnapshotAreaState[]
  readonly npcs: readonly WorldSnapshotNpcState[]
  readonly quests: readonly WorldSnapshotQuestState[]
  readonly flags: readonly string[]
  readonly log: readonly WizLogMessage[]
  readonly unlockedFacilities: readonly string[]
  readonly isEnded: boolean
}

type WorldSnapshotCanonicalValue<TValue, TShape> = TShape extends unknown
  ? TValue extends TShape
    ? TShape extends readonly (infer TShapeEntry)[]
      ? TValue extends readonly (infer TValueEntry)[]
        ? readonly WorldSnapshotCanonicalValue<TValueEntry, TShapeEntry>[]
        : TShape
      : TShape extends object
        ? TValue extends object
          ? {
              readonly [TKey in keyof TShape]: TKey extends keyof TValue
                ? WorldSnapshotCanonicalValue<TValue[TKey], TShape[TKey]>
                : TShape[TKey]
            }
          : TShape
        : TValue
    : never
  : never

/**
 * strict snapshot schemaを通過した後に実在するcanonical DTO shape。
 *
 * 入力のliteral値は保持し、schema外のproperty、class method、prototypeは型から除く。
 */
export type WorldSnapshotCanonicalData<TData extends WorldSnapshotData> =
  WorldSnapshotCanonicalValue<TData, WorldSnapshotData>

const addEquipmentOwnershipIssues = (
  snapshot: WorldSnapshotData,
  context: z.RefinementCtx,
): void => {
  Object.entries(snapshot.equipment).forEach(([slotId, entryId]) => {
    if (entryId === null) return
    if (snapshot.inventory.entries.some((entry) => entry.entryId === entryId)) return
    context.addIssue({
      code: "custom",
      path: ["equipment", slotId],
      message: `equipment slot "${slotId}" references unowned inventory entry "${entryId}"`,
    })
  })
}

const addPartyMemberIdentityIssues = (
  snapshot: WorldSnapshotData,
  context: z.RefinementCtx,
): void => {
  const firstIndexById = new Map<string, number>()
  snapshot.partyMembers.forEach((member, index) => {
    const firstIndex = firstIndexById.get(member.id)
    if (firstIndex === undefined) {
      firstIndexById.set(member.id, index)
      return
    }
    context.addIssue({
      code: "custom",
      path: ["partyMembers", index, "id"],
      message: `Duplicate partyMembers id "${member.id}"; first declared at partyMembers[${firstIndex}].id`,
    })
  })
}

export const zWorldSnapshotData = z
  .strictObject({
    player: WizVaultPlayerStateSchema,
    partyMembers: z.array(WizVaultPartyMemberStateSchema),
    inventory: WizStandardInventoryStateSchema,
    equipment: WizStandardEquipmentStateSchema,
    time: zWizVaultTimeState,
    areas: z.array(WizVaultAreaStateSchema.pick({ id: true, progress: true, unlocked: true })),
    npcs: z.array(WizVaultNpcSchema.pick({ id: true, affinity: true })),
    quests: z.array(
      z.strictObject({
        id: zWizVaultSemanticId,
        accepted: z.boolean(),
        completed: z.boolean(),
        progress: zWizVaultNonnegativeNumber.optional(),
      }),
    ),
    flags: z.array(zWizVaultSemanticId),
    log: z.array(zWizLogMessage),
    unlockedFacilities: z.array(zWizVaultSemanticId),
    isEnded: z.boolean(),
  })
  .superRefine((snapshot, context) => {
    addEquipmentOwnershipIssues(snapshot, context)
    addPartyMemberIdentityIssues(snapshot, context)
  }) satisfies z.ZodType<WorldSnapshotData>

const cloneData = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneData(entry)) as T
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, cloneData(entry)]),
    ) as T
  }
  return value
}

const worldSnapshotDataFromVault = (vault: WizVaultObject): WorldSnapshotData => ({
  player: vault.player,
  partyMembers: vault.partyMembers,
  inventory: vault.inventory,
  equipment: vault.equipment,
  time: vault.time,
  areas: vault.areas.map((area) => ({
    id: area.id,
    progress: area.progress,
    unlocked: area.unlocked,
  })),
  npcs: vault.npcs.map((npc) => ({
    id: npc.id,
    affinity: npc.affinity,
  })),
  quests: vault.quests.map((quest) => ({
    id: quest.id,
    accepted: quest.accepted,
    completed: quest.completed,
    ...("current" in quest.objective ? { progress: quest.objective.current } : {}),
  })),
  flags: vault.flags,
  log: vault.log,
  unlockedFacilities: vault.unlockedFacilities,
  isEnded: vault.isEnded,
})

/**
 * WorldContent の静的 definition を含まない immutable snapshot。
 */
export class WorldSnapshot<TData extends WorldSnapshotData = WorldSnapshotData> {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  private readonly properties: TData

  private constructor(token: typeof worldSnapshotConstructorToken, properties: TData) {
    if (token !== worldSnapshotConstructorToken) {
      throw new TypeError(
        "WorldSnapshot must be created with WorldSnapshot.create() or WorldSnapshot.fromVault()",
      )
    }
    this.properties = objectService.ownImmutable(properties) as TData
    authenticWorldSnapshots.add(this)
    WizImmutableValue.freeze(this)
  }

  static create<const TData extends WorldSnapshotData>(
    input: TData,
  ): WorldSnapshot<WorldSnapshotCanonicalData<TData>>
  static create(input: unknown): WorldSnapshot {
    return new WorldSnapshot(worldSnapshotConstructorToken, zWorldSnapshotData.parse(input))
  }

  /**
   * 信頼境界の入力をcanonical snapshotへ変換する。
   *
   * 本物のinstanceだけidentityを維持し、prototypeだけを偽装したobjectは拒否する。
   */
  static fromUnknown(input: unknown): WorldSnapshot {
    if (!(input instanceof WorldSnapshot)) {
      return new WorldSnapshot(worldSnapshotConstructorToken, zWorldSnapshotData.parse(input))
    }
    if (!authenticWorldSnapshots.has(input)) {
      throw new TypeError("WorldSnapshot instance failed runtime authenticity validation")
    }
    return input
  }

  static fromVault(input: WizVaultValue | WizVaultObject): WorldSnapshot {
    const plain = input instanceof WizVaultValue ? input.toPlain() : input
    return new WorldSnapshot(
      worldSnapshotConstructorToken,
      zWorldSnapshotData.parse(worldSnapshotDataFromVault(zWizVault.parse(plain))),
    )
  }

  get player(): TData["player"] {
    return this.properties.player
  }

  get partyMembers(): TData["partyMembers"] {
    return this.properties.partyMembers
  }

  get inventory(): TData["inventory"] {
    return this.properties.inventory
  }

  get equipment(): TData["equipment"] {
    return this.properties.equipment
  }

  get time(): TData["time"] {
    return this.properties.time
  }

  get areas(): TData["areas"] {
    return this.properties.areas
  }

  get npcs(): TData["npcs"] {
    return this.properties.npcs
  }

  get quests(): TData["quests"] {
    return this.properties.quests
  }

  get flags(): TData["flags"] {
    return this.properties.flags
  }

  get log(): TData["log"] {
    return this.properties.log
  }

  get unlockedFacilities(): TData["unlockedFacilities"] {
    return this.properties.unlockedFacilities
  }

  get isEnded(): boolean {
    return this.properties.isEnded
  }

  toPlain(): TData {
    return this.properties
  }

  clonePlain(): TData {
    return cloneData(this.properties) as TData
  }
}

Object.freeze(WorldSnapshot.prototype)
Object.freeze(WorldSnapshot)
