export const WORLD_CONTENT_KINDS = Object.freeze([
  "item",
  "weapon",
  "armor",
  "recipe",
  "monster",
  "event",
  "area",
  "npc",
  "quest",
  "facility",
  "ability",
  "shop_dialogue",
  "ability_entry",
  "inn_plan",
] as const)

export type WorldContentKind = (typeof WORLD_CONTENT_KINDS)[number]
export type WorldContentReferenceKind = WorldContentKind | "npc_dialogue"
export type WorldContentLocalIdKind =
  | "npc_dialogue"
  | "npc_dialogue_option"
  | "shop_topic"
  | "shop_product"
export type WorldContentIdKind = WorldContentKind | WorldContentLocalIdKind

export type WorldContentDiagnostic =
  | {
      readonly code: "duplicate_id"
      readonly kind: WorldContentKind
      /**
       * top-level category では省略される。NPC や shop 内だけで一意な ID の種別。
       */
      readonly idKind?: WorldContentLocalIdKind
      readonly id: string
      readonly path: string
      readonly firstPath: string
      readonly message: string
    }
  | {
      readonly code: "invalid_id"
      readonly kind: WorldContentKind
      readonly idKind: WorldContentIdKind
      readonly id: string
      readonly path: string
      readonly reason: "empty_or_whitespace" | "surrounding_whitespace"
      readonly message: string
    }
  | {
      readonly code: "invalid_reference_id"
      readonly kind: WorldContentKind
      readonly id: string
      readonly path: string
      readonly referenceId: string
      readonly expectedKind: WorldContentReferenceKind
      readonly actualKinds: readonly []
      readonly reason: "empty_or_whitespace" | "surrounding_whitespace"
      readonly message: string
    }
  | {
      readonly code: "missing_reference"
      readonly kind: WorldContentKind
      readonly id: string
      readonly path: string
      readonly referenceId: string
      readonly expectedKind: WorldContentReferenceKind
      readonly actualKinds: readonly []
      readonly message: string
    }
  | {
      readonly code: "wrong_reference_kind"
      readonly kind: WorldContentKind
      readonly id: string
      readonly path: string
      readonly referenceId: string
      readonly expectedKind: WorldContentKind
      readonly actualKinds: readonly WorldContentKind[]
      readonly message: string
    }
  | {
      readonly code: "cyclic_reference"
      readonly kind: "area" | "quest"
      readonly id: string
      readonly path: string
      readonly referenceId: string
      readonly expectedKind: "area" | "quest"
      readonly cycle: readonly string[]
      readonly message: string
    }

export const freezeWorldContentDiagnostic = (
  diagnostic: WorldContentDiagnostic,
): WorldContentDiagnostic => {
  switch (diagnostic.code) {
    case "invalid_reference_id":
    case "missing_reference":
      return Object.freeze({
        ...diagnostic,
        actualKinds: Object.freeze([] as const),
      })
    case "wrong_reference_kind":
      return Object.freeze({
        ...diagnostic,
        actualKinds: Object.freeze([...diagnostic.actualKinds]),
      })
    case "cyclic_reference":
      return Object.freeze({
        ...diagnostic,
        cycle: Object.freeze([...diagnostic.cycle]),
      })
    case "duplicate_id":
    case "invalid_id":
      return Object.freeze(diagnostic)
  }
}

export class WorldContentValidationError extends Error {
  override readonly name = "WorldContentValidationError"
  readonly diagnostics: readonly WorldContentDiagnostic[]

  constructor(diagnostics: readonly WorldContentDiagnostic[]) {
    const frozenDiagnostics = Object.freeze(diagnostics.map(freezeWorldContentDiagnostic))
    super(
      `World content validation failed with ${frozenDiagnostics.length} diagnostic${
        frozenDiagnostics.length === 1 ? "" : "s"
      }`,
    )
    this.diagnostics = frozenDiagnostics
    Object.freeze(this)
  }
}

Object.freeze(WorldContentValidationError.prototype)
Object.freeze(WorldContentValidationError)
