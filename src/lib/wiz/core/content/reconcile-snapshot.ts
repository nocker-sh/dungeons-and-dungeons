import type { WorldContentArrays } from "@/lib/wiz/core/content/schema"
import { WorldSnapshot, type WorldSnapshotData } from "@/lib/wiz/core/save/world-snapshot"

export const WORLD_SNAPSHOT_ORPHAN_POLICIES = Object.freeze(["keep", "drop", "error"] as const)

export type WorldSnapshotOrphanPolicy = (typeof WORLD_SNAPSHOT_ORPHAN_POLICIES)[number]

export type WorldSnapshotReconcileCategoryPolicy = {
  /** 省略したcategoryはkeepとして扱う。 */
  readonly areas?: WorldSnapshotOrphanPolicy
  readonly npcs?: WorldSnapshotOrphanPolicy
  readonly quests?: WorldSnapshotOrphanPolicy
  readonly items?: WorldSnapshotOrphanPolicy
  readonly weapons?: WorldSnapshotOrphanPolicy
  readonly armors?: WorldSnapshotOrphanPolicy
  readonly abilities?: WorldSnapshotOrphanPolicy
  readonly facilities?: WorldSnapshotOrphanPolicy
}

export type WorldSnapshotReconcilePolicy =
  | WorldSnapshotOrphanPolicy
  | WorldSnapshotReconcileCategoryPolicy

export type WorldSnapshotReconcileKind =
  | "area"
  | "npc"
  | "quest"
  | "item"
  | "weapon"
  | "armor"
  | "ability"
  | "facility"

export type WorldSnapshotReconcileDiagnostic =
  | {
      readonly code: "duplicate_id"
      readonly kind: WorldSnapshotReconcileKind
      readonly id: string
      readonly path: string
      readonly firstPath: string
      readonly message: string
    }
  | {
      readonly code: "orphaned_state"
      readonly kind: WorldSnapshotReconcileKind
      readonly id: string
      readonly path: string
      readonly message: string
    }

type NormalizedPolicy = {
  readonly areas: WorldSnapshotOrphanPolicy
  readonly npcs: WorldSnapshotOrphanPolicy
  readonly quests: WorldSnapshotOrphanPolicy
  readonly items: WorldSnapshotOrphanPolicy
  readonly weapons: WorldSnapshotOrphanPolicy
  readonly armors: WorldSnapshotOrphanPolicy
  readonly abilities: WorldSnapshotOrphanPolicy
  readonly facilities: WorldSnapshotOrphanPolicy
}

type IdentifiedState = {
  readonly id: string
}

type SnapshotReference = {
  readonly id: string
  readonly path: string
}

const isOrphanPolicy = (value: unknown): value is WorldSnapshotOrphanPolicy =>
  WORLD_SNAPSHOT_ORPHAN_POLICIES.some((policy) => policy === value)

const normalizePolicy = (policy: WorldSnapshotReconcilePolicy): NormalizedPolicy => {
  if (isOrphanPolicy(policy)) {
    return Object.freeze({
      areas: policy,
      npcs: policy,
      quests: policy,
      items: policy,
      weapons: policy,
      armors: policy,
      abilities: policy,
      facilities: policy,
    })
  }
  if (!policy || typeof policy !== "object") {
    throw new RangeError('World snapshot reconcile policy must be "keep", "drop", or "error"')
  }
  const normalized = {
    areas: policy.areas ?? "keep",
    npcs: policy.npcs ?? "keep",
    quests: policy.quests ?? "keep",
    items: policy.items ?? "keep",
    weapons: policy.weapons ?? "keep",
    armors: policy.armors ?? "keep",
    abilities: policy.abilities ?? "keep",
    facilities: policy.facilities ?? "keep",
  } as const
  if (Object.values(normalized).some((value) => !isOrphanPolicy(value))) {
    throw new RangeError(
      'Every world snapshot reconcile category policy must be "keep", "drop", or "error"',
    )
  }
  return Object.freeze(normalized)
}

const duplicateDiagnostics = (
  states: readonly IdentifiedState[],
  kind: WorldSnapshotReconcileKind,
  pathPrefix: string,
): readonly WorldSnapshotReconcileDiagnostic[] =>
  states.flatMap((state, index) => {
    const firstIndex = states.findIndex((candidate) => candidate.id === state.id)
    if (firstIndex === index) return []
    const path = `${pathPrefix}[${index}].id`
    const firstPath = `${pathPrefix}[${firstIndex}].id`
    return [
      {
        code: "duplicate_id",
        kind,
        id: state.id,
        path,
        firstPath,
        message: `Duplicate ${kind} snapshot id "${state.id}" at ${path}; first declared at ${firstPath}`,
      },
    ]
  })

const orphanDiagnostics = (
  references: readonly SnapshotReference[],
  definitionIds: ReadonlySet<string>,
  kind: WorldSnapshotReconcileKind,
  policy: WorldSnapshotOrphanPolicy,
): readonly WorldSnapshotReconcileDiagnostic[] => {
  if (policy !== "error") return []
  return references.flatMap((reference) => {
    if (definitionIds.has(reference.id)) return []
    return [
      {
        code: "orphaned_state",
        kind,
        id: reference.id,
        path: reference.path,
        message: `Orphaned ${kind} snapshot id "${reference.id}" at ${reference.path}`,
      },
    ]
  })
}

const stateReferences = (
  states: readonly IdentifiedState[],
  pathPrefix: string,
): readonly SnapshotReference[] =>
  states.map((state, index) => ({
    id: state.id,
    path: `${pathPrefix}[${index}].id`,
  }))

const reconcileStates = <TDefinition extends IdentifiedState, TState extends IdentifiedState>(
  definitions: readonly TDefinition[],
  states: readonly TState[],
  policy: WorldSnapshotOrphanPolicy,
  createState: (definition: TDefinition) => TState,
): readonly TState[] => {
  const definitionsById = new Set(definitions.map((definition) => definition.id))
  const statesById = new Map(states.map((state) => [state.id, state]))
  const currentStates = definitions.map(
    (definition) => statesById.get(definition.id) ?? createState(definition),
  )
  if (policy !== "keep") return currentStates
  return [...currentStates, ...states.filter((state) => !definitionsById.has(state.id))]
}

const reconcileIds = (
  ids: readonly string[],
  definitionIds: ReadonlySet<string>,
  policy: WorldSnapshotOrphanPolicy,
): readonly string[] => (policy === "drop" ? ids.filter((id) => definitionIds.has(id)) : [...ids])

const reconcileEquipmentId = (
  id: string | null,
  definitionIds: ReadonlySet<string>,
  policy: WorldSnapshotOrphanPolicy,
): string | null => (id !== null && policy === "drop" && !definitionIds.has(id) ? null : id)

const freezeDiagnostic = (
  diagnostic: WorldSnapshotReconcileDiagnostic,
): WorldSnapshotReconcileDiagnostic => Object.freeze({ ...diagnostic })

export class WorldSnapshotReconcileError extends Error {
  override readonly name = "WorldSnapshotReconcileError"
  readonly diagnostics: readonly WorldSnapshotReconcileDiagnostic[]

  constructor(diagnostics: readonly WorldSnapshotReconcileDiagnostic[]) {
    const frozenDiagnostics = Object.freeze(diagnostics.map(freezeDiagnostic))
    super(
      `World snapshot reconciliation failed with ${frozenDiagnostics.length} diagnostic${
        frozenDiagnostics.length === 1 ? "" : "s"
      }`,
    )
    this.diagnostics = frozenDiagnostics
    Object.freeze(this)
  }
}

/**
 * 静的 content と dynamic snapshot の ID 差分を純粋に整合する。
 * 新規 state の生成は area/NPC/quest だけに限定する。
 *
 * Save envelope や contentVersion は扱わず、現在のsnapshotだけを整合する。
 */
export const reconcileWorldSnapshot = (
  content: Pick<
    WorldContentArrays,
    "areas" | "npcs" | "quests" | "items" | "weapons" | "armors" | "abilities" | "facilities"
  >,
  input: unknown,
  policy: WorldSnapshotReconcilePolicy,
): WorldSnapshot => {
  const snapshot = WorldSnapshot.fromUnknown(input)
  const normalizedPolicy = normalizePolicy(policy)
  const plain: WorldSnapshotData = snapshot.toPlain()
  const areaIdSet = new Set(content.areas.map((area) => area.id))
  const npcIds = new Set(content.npcs.map((npc) => npc.id))
  const questIds = new Set(content.quests.map((quest) => quest.id))
  const itemIds = new Set(content.items.map((item) => item.id))
  const weaponIds = new Set(content.weapons.map((weapon) => weapon.id))
  const armorIds = new Set(content.armors.map((armor) => armor.id))
  const abilityIds = new Set(content.abilities.map((ability) => ability.id))
  const facilityIds = new Set(content.facilities.map((facility) => facility.facilityId))
  const inventoryReferences = plain.inventory.entries.map((entry, index) => ({
    id: entry.contentId,
    path: `inventory.entries[${index}].contentId`,
    type: entry.contentType,
  }))
  const itemReferences = inventoryReferences.filter((entry) => entry.type === "item")
  const weaponReferences = inventoryReferences.filter((entry) => entry.type === "weapon")
  const armorReferences = inventoryReferences.filter((entry) => entry.type === "armor")
  const abilityReferences = [
    ...plain.player.abilityIds.map((id, index) => ({
      id,
      path: `player.abilityIds[${index}]`,
    })),
    ...plain.partyMembers.flatMap((member, memberIndex) =>
      member.abilityIds.map((id, abilityIndex) => ({
        id,
        path: `partyMembers[${memberIndex}].abilityIds[${abilityIndex}]`,
      })),
    ),
  ]
  const facilityReferences = plain.unlockedFacilities.map((id, index) => ({
    id,
    path: `unlockedFacilities[${index}]`,
  }))
  const diagnostics = [
    ...duplicateDiagnostics(plain.areas, "area", "areas"),
    ...duplicateDiagnostics(plain.npcs, "npc", "npcs"),
    ...duplicateDiagnostics(plain.quests, "quest", "quests"),
    ...orphanDiagnostics(
      stateReferences(plain.areas, "areas"),
      areaIdSet,
      "area",
      normalizedPolicy.areas,
    ),
    ...orphanDiagnostics(stateReferences(plain.npcs, "npcs"), npcIds, "npc", normalizedPolicy.npcs),
    ...orphanDiagnostics(
      stateReferences(plain.quests, "quests"),
      questIds,
      "quest",
      normalizedPolicy.quests,
    ),
    ...orphanDiagnostics(itemReferences, itemIds, "item", normalizedPolicy.items),
    ...orphanDiagnostics(weaponReferences, weaponIds, "weapon", normalizedPolicy.weapons),
    ...orphanDiagnostics(armorReferences, armorIds, "armor", normalizedPolicy.armors),
    ...orphanDiagnostics(abilityReferences, abilityIds, "ability", normalizedPolicy.abilities),
    ...orphanDiagnostics(facilityReferences, facilityIds, "facility", normalizedPolicy.facilities),
  ]
  if (diagnostics.length > 0) {
    throw new WorldSnapshotReconcileError(diagnostics)
  }

  return WorldSnapshot.create({
    ...plain,
    player: {
      ...plain.player,
      abilityIds: reconcileIds(plain.player.abilityIds, abilityIds, normalizedPolicy.abilities),
    },
    partyMembers: plain.partyMembers.map((member) => ({
      ...member,
      abilityIds: reconcileIds(member.abilityIds, abilityIds, normalizedPolicy.abilities),
    })),
    inventory: {
      ...plain.inventory,
      entries: plain.inventory.entries.filter((entry) => {
        if (entry.contentType === "item") {
          return normalizedPolicy.items !== "drop" || itemIds.has(entry.contentId)
        }
        if (entry.contentType === "weapon") {
          return normalizedPolicy.weapons !== "drop" || weaponIds.has(entry.contentId)
        }
        return normalizedPolicy.armors !== "drop" || armorIds.has(entry.contentId)
      }),
    },
    equipment: Object.fromEntries(
      [
        ...new Set([
          ...content.weapons.map((weapon) => weapon.slotId),
          ...content.armors.map((armor) => armor.slotId),
          ...Object.keys(plain.equipment),
        ]),
      ].map((slotId) => {
        const entryId = plain.equipment[slotId] ?? null
        if (entryId === null) return [slotId, null]
        const entry = plain.inventory.entries.find((candidate) => candidate.entryId === entryId)
        if (entry === undefined) return [slotId, null]
        const ids =
          entry.contentType === "weapon"
            ? weaponIds
            : entry.contentType === "armor"
              ? armorIds
              : itemIds
        const entryPolicy =
          entry.contentType === "weapon"
            ? normalizedPolicy.weapons
            : entry.contentType === "armor"
              ? normalizedPolicy.armors
              : normalizedPolicy.items
        return [
          slotId,
          reconcileEquipmentId(entry.contentId, ids, entryPolicy) === null ? null : entryId,
        ]
      }),
    ),
    areas: reconcileStates(content.areas, plain.areas, normalizedPolicy.areas, (area) => ({
      id: area.id,
      progress: 0,
      unlocked: area.unlocked,
    })),
    npcs: reconcileStates(content.npcs, plain.npcs, normalizedPolicy.npcs, (npc) => ({
      id: npc.id,
      affinity: npc.initialAffinity,
    })),
    quests: reconcileStates(content.quests, plain.quests, normalizedPolicy.quests, (quest) => ({
      id: quest.id,
      accepted: false,
      completed: false,
      ...(quest.objective.type === "defeat" || quest.objective.type === "gather"
        ? { progress: 0 }
        : {}),
    })),
    unlockedFacilities: reconcileIds(
      plain.unlockedFacilities,
      facilityIds,
      normalizedPolicy.facilities,
    ),
  })
}

Object.freeze(WorldSnapshotReconcileError.prototype)
Object.freeze(WorldSnapshotReconcileError)
