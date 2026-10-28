import { WORLD_CONTENT_KINDS, type WorldContentKind } from "@/lib/wiz/core/content/diagnostic"
import type { WorldContentArrays } from "@/lib/wiz/core/content/schema"
import type { WorldSnapshotData } from "@/lib/wiz/core/save/world-snapshot"

export type WorldSnapshotExpectedKind = WorldContentKind | "flag" | "party_member"

export type WorldSnapshotDiagnostic =
  | {
      readonly code: "duplicate_id"
      readonly expectedKind: WorldSnapshotExpectedKind
      readonly id: string
      readonly path: string
      readonly firstPath: string
      readonly message: string
    }
  | {
      readonly code: "reserved_id"
      readonly expectedKind: "party_member"
      readonly id: string
      readonly path: string
      readonly reservedFor: "player"
      readonly message: string
    }
  | {
      readonly code: "invalid_id"
      readonly expectedKind: "party_member"
      readonly id: string
      readonly path: string
      readonly reason: "empty_or_whitespace" | "leading_or_trailing_whitespace"
      readonly message: string
    }
  | {
      readonly code: "invalid_quest_progress"
      readonly expectedKind: "quest"
      readonly id: string
      readonly path: string
      readonly objectiveType: "defeat" | "gather" | "explore" | "deliver"
      readonly reason: "required" | "not_allowed" | "not_finite_integer" | "out_of_range"
      readonly progress?: number
      readonly minimum?: 0
      readonly maximum?: number
      readonly message: string
    }
  | {
      readonly code: "invalid_quest_completion"
      readonly expectedKind: "quest"
      readonly id: string
      readonly path: string
      readonly reason: "completed_without_acceptance"
      readonly message: string
    }
  | {
      readonly code: "missing_state"
      readonly expectedKind: "area" | "npc" | "quest"
      readonly id: string
      /**
       * 不足 state を要求する静的 definition の正確な path。
       */
      readonly path: string
      readonly message: string
    }
  | {
      readonly code: "missing_reference" | "wrong_reference_kind"
      readonly expectedKind: WorldSnapshotExpectedKind
      readonly id: string
      readonly path: string
      readonly actualKinds: readonly WorldContentKind[]
      readonly message: string
    }

const freezeDiagnostic = (diagnostic: WorldSnapshotDiagnostic): WorldSnapshotDiagnostic => {
  if (
    diagnostic.code === "duplicate_id" ||
    diagnostic.code === "reserved_id" ||
    diagnostic.code === "invalid_id" ||
    diagnostic.code === "invalid_quest_progress" ||
    diagnostic.code === "invalid_quest_completion" ||
    diagnostic.code === "missing_state"
  ) {
    return Object.freeze(diagnostic)
  }
  return Object.freeze({
    ...diagnostic,
    actualKinds: Object.freeze([...diagnostic.actualKinds]),
  })
}

type SnapshotReference = {
  readonly expectedKind: WorldSnapshotExpectedKind
  readonly id: string
  readonly path: string
}

const idsForKind = (
  content: WorldContentArrays,
  kind: WorldSnapshotExpectedKind,
): readonly string[] => {
  switch (kind) {
    case "item":
      return content.items.map((entry) => entry.id)
    case "weapon":
      return content.weapons.map((entry) => entry.id)
    case "armor":
      return content.armors.map((entry) => entry.id)
    case "recipe":
      return content.recipes.map((entry) => entry.id)
    case "monster":
      return content.monsters.map((entry) => entry.id)
    case "event":
      return content.events.map((entry) => entry.id)
    case "area":
      return content.areas.map((entry) => entry.id)
    case "npc":
      return content.npcs.map((entry) => entry.id)
    case "quest":
      return content.quests.map((entry) => entry.id)
    case "facility":
      return content.facilities.map((entry) => entry.facilityId)
    case "ability":
      return content.abilities.map((entry) => entry.id)
    case "shop_dialogue":
      return content.shopDialogues.map((entry) => entry.shopId)
    case "ability_entry":
      return content.abilityTable.map((entry) => entry.abilityId)
    case "inn_plan":
      return content.innPlans.map((entry) => entry.id)
    case "flag":
    case "party_member":
      return []
  }
}

const duplicateDiagnostics = (
  entries: readonly { readonly id: string; readonly path: string }[],
  expectedKind: WorldSnapshotExpectedKind,
): readonly WorldSnapshotDiagnostic[] =>
  entries.flatMap((entry, index) => {
    const firstIndex = entries.findIndex((candidate) => candidate.id === entry.id)
    if (firstIndex === index) {
      return []
    }
    const firstPath = entries[firstIndex].path
    return [
      {
        code: "duplicate_id",
        expectedKind,
        id: entry.id,
        path: entry.path,
        firstPath,
        message: `Duplicate ${expectedKind} snapshot id "${entry.id}" at ${entry.path}; first declared at ${firstPath}`,
      },
    ]
  })

const missingStateDiagnostics = (
  definitions: readonly { readonly id: string }[],
  states: readonly { readonly id: string }[],
  expectedKind: "area" | "npc" | "quest",
  pathPrefix: "areas" | "npcs" | "quests",
): readonly WorldSnapshotDiagnostic[] => {
  const stateIds = new Set(states.map((state) => state.id))
  return definitions.flatMap((definition, index) => {
    if (stateIds.has(definition.id)) return []
    const path = `${pathPrefix}[${index}].id`
    return [
      {
        code: "missing_state",
        expectedKind,
        id: definition.id,
        path,
        message: `Missing ${expectedKind} snapshot state for content "${definition.id}" declared at ${path}`,
      },
    ]
  })
}

const reservedPartyMemberDiagnostics = (
  partyMembers: WorldSnapshotData["partyMembers"],
): readonly WorldSnapshotDiagnostic[] =>
  partyMembers.flatMap((member, index) =>
    member.id === "player"
      ? [
          {
            code: "reserved_id" as const,
            expectedKind: "party_member" as const,
            id: member.id,
            path: `partyMembers[${index}].id`,
            reservedFor: "player" as const,
            message: `Reserved party_member id "player" at partyMembers[${index}].id is owned by the canonical player actor`,
          },
        ]
      : [],
  )

const invalidPartyMemberDiagnostics = (
  partyMembers: WorldSnapshotData["partyMembers"],
): readonly WorldSnapshotDiagnostic[] =>
  partyMembers.flatMap<WorldSnapshotDiagnostic>((member, index) => {
    const path = `partyMembers[${index}].id`
    if (member.id.trim().length === 0) {
      return [
        {
          code: "invalid_id" as const,
          expectedKind: "party_member" as const,
          id: member.id,
          path,
          reason: "empty_or_whitespace" as const,
          message: `Party member id at ${path} must not be empty or whitespace`,
        },
      ]
    }
    return member.id === member.id.trim()
      ? []
      : [
          {
            code: "invalid_id" as const,
            expectedKind: "party_member" as const,
            id: member.id,
            path,
            reason: "leading_or_trailing_whitespace" as const,
            message: `Party member id at ${path} must not have leading or trailing whitespace`,
          },
        ]
  })

const questStateDiagnostics = (
  content: WorldContentArrays,
  questStates: WorldSnapshotData["quests"],
): readonly WorldSnapshotDiagnostic[] => {
  const definitions = new Map(content.quests.map((quest) => [quest.id, quest]))

  return questStates.flatMap<WorldSnapshotDiagnostic>((state, index) => {
    const definition = definitions.get(state.id)
    if (!definition) {
      return []
    }

    const statePath = `quests[${index}]`
    const objectiveType = definition.objective.type
    const diagnostics: WorldSnapshotDiagnostic[] = []
    if (objectiveType === "defeat" || objectiveType === "gather") {
      const maximum = definition.objective.count
      if (state.progress === undefined) {
        diagnostics.push({
          code: "invalid_quest_progress",
          expectedKind: "quest",
          id: state.id,
          path: `${statePath}.progress`,
          objectiveType,
          reason: "required",
          minimum: 0,
          maximum,
          message: `Quest "${state.id}" ${objectiveType} progress is required at ${statePath}.progress`,
        })
      } else if (!Number.isFinite(state.progress) || !Number.isInteger(state.progress)) {
        diagnostics.push({
          code: "invalid_quest_progress",
          expectedKind: "quest",
          id: state.id,
          path: `${statePath}.progress`,
          objectiveType,
          reason: "not_finite_integer",
          progress: state.progress,
          minimum: 0,
          maximum,
          message: `Quest "${state.id}" ${objectiveType} progress at ${statePath}.progress must be a finite integer`,
        })
      } else if (state.progress < 0 || state.progress > maximum) {
        diagnostics.push({
          code: "invalid_quest_progress",
          expectedKind: "quest",
          id: state.id,
          path: `${statePath}.progress`,
          objectiveType,
          reason: "out_of_range",
          progress: state.progress,
          minimum: 0,
          maximum,
          message: `Quest "${state.id}" ${objectiveType} progress at ${statePath}.progress must be between 0 and ${maximum}`,
        })
      }
    } else if (state.progress !== undefined) {
      diagnostics.push({
        code: "invalid_quest_progress",
        expectedKind: "quest",
        id: state.id,
        path: `${statePath}.progress`,
        objectiveType,
        reason: "not_allowed",
        progress: state.progress,
        message: `Quest "${state.id}" ${objectiveType} objective must not persist progress at ${statePath}.progress`,
      })
    }

    if (state.completed && !state.accepted) {
      diagnostics.push({
        code: "invalid_quest_completion",
        expectedKind: "quest",
        id: state.id,
        path: `${statePath}.completed`,
        reason: "completed_without_acceptance",
        message: `Quest "${state.id}" at ${statePath} cannot be completed without being accepted`,
      })
    }
    return diagnostics
  })
}

const snapshotReferences = (snapshot: WorldSnapshotData): readonly SnapshotReference[] => [
  ...snapshot.areas.map((entry, index) => ({
    expectedKind: "area" as const,
    id: entry.id,
    path: `areas[${index}].id`,
  })),
  ...snapshot.npcs.map((entry, index) => ({
    expectedKind: "npc" as const,
    id: entry.id,
    path: `npcs[${index}].id`,
  })),
  ...snapshot.quests.map((entry, index) => ({
    expectedKind: "quest" as const,
    id: entry.id,
    path: `quests[${index}].id`,
  })),
  ...snapshot.inventory.entries.map((entry, index) => ({
    expectedKind: entry.contentType,
    id: entry.contentId,
    path: `inventory.entries[${index}].contentId`,
  })),
  ...snapshot.player.abilityIds.map((id, index) => ({
    expectedKind: "ability" as const,
    id,
    path: `player.abilityIds[${index}]`,
  })),
  ...snapshot.partyMembers.flatMap((member, memberIndex) =>
    member.abilityIds.map((id, abilityIndex) => ({
      expectedKind: "ability" as const,
      id,
      path: `partyMembers[${memberIndex}].abilityIds[${abilityIndex}]`,
    })),
  ),
  ...snapshot.unlockedFacilities.map((id, index) => ({
    expectedKind: "facility" as const,
    id,
    path: `unlockedFacilities[${index}]`,
  })),
]

const diagnoseReference = (
  content: WorldContentArrays,
  reference: SnapshotReference,
): readonly WorldSnapshotDiagnostic[] => {
  if (idsForKind(content, reference.expectedKind).includes(reference.id)) {
    return []
  }

  const actualKinds = WORLD_CONTENT_KINDS.filter(
    (kind) => kind !== "ability_entry" && idsForKind(content, kind).includes(reference.id),
  )
  const code = actualKinds.length === 0 ? "missing_reference" : "wrong_reference_kind"
  return [
    {
      code,
      expectedKind: reference.expectedKind,
      id: reference.id,
      path: reference.path,
      actualKinds,
      message:
        code === "missing_reference"
          ? `Missing ${reference.expectedKind} "${reference.id}" referenced by snapshot ${reference.path}`
          : `Expected ${reference.expectedKind} "${reference.id}" at snapshot ${
              reference.path
            }, but found ${actualKinds.join(", ")}`,
    },
  ]
}

export const diagnoseWorldSnapshot = (
  content: WorldContentArrays,
  snapshot: WorldSnapshotData,
): readonly WorldSnapshotDiagnostic[] =>
  Object.freeze(
    [
      ...duplicateDiagnostics(
        snapshot.areas.map((entry, index) => ({
          id: entry.id,
          path: `areas[${index}].id`,
        })),
        "area",
      ),
      ...duplicateDiagnostics(
        snapshot.npcs.map((entry, index) => ({
          id: entry.id,
          path: `npcs[${index}].id`,
        })),
        "npc",
      ),
      ...duplicateDiagnostics(
        snapshot.quests.map((entry, index) => ({
          id: entry.id,
          path: `quests[${index}].id`,
        })),
        "quest",
      ),
      ...duplicateDiagnostics(
        snapshot.partyMembers.map((entry, index) => ({
          id: entry.id,
          path: `partyMembers[${index}].id`,
        })),
        "party_member",
      ),
      ...duplicateDiagnostics(
        snapshot.player.abilityIds.map((id, index) => ({
          id,
          path: `player.abilityIds[${index}]`,
        })),
        "ability",
      ),
      ...snapshot.partyMembers.flatMap((member, memberIndex) =>
        duplicateDiagnostics(
          member.abilityIds.map((id, abilityIndex) => ({
            id,
            path: `partyMembers[${memberIndex}].abilityIds[${abilityIndex}]`,
          })),
          "ability",
        ),
      ),
      ...duplicateDiagnostics(
        snapshot.flags.map((id, index) => ({
          id,
          path: `flags[${index}]`,
        })),
        "flag",
      ),
      ...duplicateDiagnostics(
        snapshot.unlockedFacilities.map((id, index) => ({
          id,
          path: `unlockedFacilities[${index}]`,
        })),
        "facility",
      ),
      ...invalidPartyMemberDiagnostics(snapshot.partyMembers),
      ...reservedPartyMemberDiagnostics(snapshot.partyMembers),
      ...missingStateDiagnostics(content.areas, snapshot.areas, "area", "areas"),
      ...missingStateDiagnostics(content.npcs, snapshot.npcs, "npc", "npcs"),
      ...missingStateDiagnostics(content.quests, snapshot.quests, "quest", "quests"),
      ...questStateDiagnostics(content, snapshot.quests),
      ...snapshotReferences(snapshot).flatMap((reference) => diagnoseReference(content, reference)),
    ].map(freezeDiagnostic),
  )

export class WorldSnapshotValidationError extends Error {
  override readonly name = "WorldSnapshotValidationError"
  readonly diagnostics: readonly WorldSnapshotDiagnostic[]

  constructor(diagnostics: readonly WorldSnapshotDiagnostic[]) {
    const frozenDiagnostics = Object.freeze(diagnostics.map(freezeDiagnostic))
    super(
      `World snapshot validation failed with ${frozenDiagnostics.length} diagnostic${
        frozenDiagnostics.length === 1 ? "" : "s"
      }`,
    )
    this.diagnostics = frozenDiagnostics
    Object.freeze(this)
  }
}

Object.freeze(WorldSnapshotValidationError.prototype)
Object.freeze(WorldSnapshotValidationError)
