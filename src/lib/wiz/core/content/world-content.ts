import { WorldContentValidationError } from "@/lib/wiz/core/content/diagnostic"
import {
  reconcileWorldSnapshot,
  type WorldSnapshotOrphanPolicy,
  type WorldSnapshotReconcilePolicy,
} from "@/lib/wiz/core/content/reconcile-snapshot"
import { diagnoseWorldContent } from "@/lib/wiz/core/content/reference-rules"
import {
  type NormalizeWorldContentArrays,
  type WorldContentArrays,
  type WorldContentArraysInput,
  zWorldContentArrays,
} from "@/lib/wiz/core/content/schema"
import {
  diagnoseWorldSnapshot,
  WorldSnapshotValidationError,
} from "@/lib/wiz/core/content/snapshot-rules"
import type { WorldContentReferenceConstraint } from "@/lib/wiz/core/content/type-safe-input"
import { WorldContentCreateValidation } from "@/lib/wiz/core/content/world-content-create-validation"
import {
  createWizImmutableRecord,
  getWizImmutableRecordValue,
} from "@/lib/wiz/core/immutable-record"
import type { WizDeepReadonly, WizImmutableValueContract } from "@/lib/wiz/core/immutable-value"
import { WorldSnapshot, type WorldSnapshotData } from "@/lib/wiz/core/save/world-snapshot"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import {
  WizStandardSchema,
  type WizStandardSchemaDefinition,
  type WizStandardSchemaInput,
  type WizStandardSchemaOutput,
} from "@/lib/wiz/core/standard-schema"
import { WIZ_STANDARD_DEFAULT_INVENTORY } from "@/lib/wiz/core/vault/standard-inventory"
import {
  WIZ_VAULT_DEFAULT_PLAYER,
  type WizVaultPlayerState,
} from "@/lib/wiz/core/vault/states/player/schema"
import { WIZ_VAULT_DEFAULT_TIME } from "@/lib/wiz/core/vault/states/time/schema"

const objectService = new WizObjectService()
const worldContentConstructorToken = Symbol("WorldContent.constructor")
const worldContentSchema = WizStandardSchema.capture(
  zWorldContentArrays,
  "Built-in world content schema",
)

/**
 * 汎用content入口で使う言語非依存の最小player。
 *
 * standard presetの表示名付きdefaultとは分離し、root APIから特定言語を漏らさない。
 */
export const WORLD_DEFAULT_INITIAL_PLAYER: WizDeepReadonly<WizVaultPlayerState> =
  objectService.ownImmutable({
    ...WIZ_VAULT_DEFAULT_PLAYER,
    name: "player",
  })
const createInitialEquipment = (
  arrays: Pick<WorldContentArrays, "weapons" | "armors">,
): WorldSnapshotData["equipment"] =>
  objectService.ownImmutable(
    Object.fromEntries(
      [...arrays.weapons, ...arrays.armors].map((equipment) => [equipment.slotId, null]),
    ),
  )

type WorldContentReadonlyArrays<TArrays extends WorldContentArrays> = WizDeepReadonly<TArrays>

type WorldContentStrictInputValue<TValue, TShape> = TShape extends unknown
  ? TValue extends TShape
    ? TShape extends readonly (infer TShapeEntry)[]
      ? TValue extends readonly (infer TValueEntry)[]
        ? readonly WorldContentStrictInputValue<TValueEntry, TShapeEntry>[]
        : never
      : TShape extends object
        ? TValue extends object
          ? Exclude<keyof TValue, keyof TShape> extends never
            ? {
                readonly [TKey in keyof TValue]: TKey extends keyof TShape
                  ? WorldContentStrictInputValue<TValue[TKey], TShape[TKey]>
                  : never
              }
            : never
          : never
        : TValue
    : never
  : never

type WorldContentStandardInputConstraint<TInput extends WorldContentArraysInput> =
  WorldContentStrictInputValue<TInput, WorldContentArraysInput>

type EntryForId<TEntry, TId extends string> = TEntry extends {
  readonly id: infer TEntryId extends string
}
  ? TId extends TEntryId
    ? TEntry
    : never
  : never

type EntryId<TEntry> = TEntry extends { readonly id: infer TId extends string } ? TId : never

type IsUnion<TValue, TAll = TValue> = TValue extends unknown
  ? [TAll] extends [TValue]
    ? false
    : true
  : never

type IsSingleStringLiteral<TValue extends string> = string extends TValue
  ? false
  : true extends IsUnion<TValue>
    ? false
    : true

type DefiniteEntryId<TEntries extends readonly { readonly id: string }[]> =
  number extends TEntries["length"]
    ? never
    : TEntries[number] extends infer TEntry
      ? TEntry extends { readonly id: infer TId extends string }
        ? IsSingleStringLiteral<TId> extends true
          ? TId
          : never
        : never
      : never

type EntryLookupResult<TEntries extends readonly { readonly id: string }[], TId extends string> =
  IsSingleStringLiteral<TId> extends true
    ? [TId] extends [DefiniteEntryId<TEntries>]
      ? EntryForId<TEntries[number], TId>
      : EntryForId<TEntries[number], TId> | undefined
    : EntryForId<TEntries[number], TId> | undefined

/**
 * ID recordの型。
 *
 * literal tupleに実在すると証明できるIDだけを必須propertyにし、通常配列やunion IDは
 * optionalに保つ。有限union型の配列が、その全要素を実際に含むとは仮定しない。
 */
export type WorldContentRecord<TEntries extends readonly { readonly id: string }[]> = Readonly<
  {
    readonly [TId in EntryId<TEntries[number]>]?: WizDeepReadonly<EntryForId<TEntries[number], TId>>
  } & {
    readonly [TId in DefiniteEntryId<TEntries>]-?: WizDeepReadonly<
      EntryForId<TEntries[number], TId>
    >
  }
>

type FacilityForId<TEntry, TId extends string> = TEntry extends {
  readonly facilityId: infer TEntryId extends string
}
  ? TId extends TEntryId
    ? TEntry
    : never
  : never

type FacilityId<TEntry> = TEntry extends {
  readonly facilityId: infer TId extends string
}
  ? TId
  : never

type DefiniteFacilityId<TEntries extends readonly { readonly facilityId: string }[]> =
  number extends TEntries["length"]
    ? never
    : TEntries[number] extends infer TEntry
      ? TEntry extends { readonly facilityId: infer TId extends string }
        ? IsSingleStringLiteral<TId> extends true
          ? TId
          : never
        : never
      : never

type FacilityLookupResult<
  TEntries extends readonly { readonly facilityId: string }[],
  TId extends string,
> =
  IsSingleStringLiteral<TId> extends true
    ? [TId] extends [DefiniteFacilityId<TEntries>]
      ? FacilityForId<TEntries[number], TId>
      : FacilityForId<TEntries[number], TId> | undefined
    : FacilityForId<TEntries[number], TId> | undefined

export type WorldFacilityRecord<TEntries extends readonly { readonly facilityId: string }[]> =
  Readonly<
    {
      readonly [TId in FacilityId<TEntries[number]>]?: WizDeepReadonly<
        FacilityForId<TEntries[number], TId>
      >
    } & {
      readonly [TId in DefiniteFacilityId<TEntries>]-?: WizDeepReadonly<
        FacilityForId<TEntries[number], TId>
      >
    }
  >

export type WorldContentSchemaOptions<
  TSchema extends WizStandardSchemaDefinition<unknown, WorldContentArrays>,
> = {
  /**
   * 標準 schema を extend した schema を渡すと、独自 category / 独自 field も
   * runtime validation したまま TArrays に保持できる。
   * schemaはparse中に変更しない、信頼済みの純粋なvalidation dependencyとして扱う。
   */
  readonly schema: TSchema
}

export type WorldContentCreateOptions<
  TSchema extends WizStandardSchemaDefinition<unknown, WorldContentArrays>,
> = {
  /**
   * 独自category / fieldを含むTypeScript入力を検証してcanonical outputへ変換するschema。
   */
  readonly schema: TSchema
}

type WorldContentBuiltinInput<TInput extends object> = Pick<
  TInput,
  Extract<keyof TInput, keyof WorldContentArraysInput>
>

type WorldContentCreateReferenceConstraint<TInput extends object> =
  WorldContentBuiltinInput<TInput> extends WorldContentArraysInput
    ? WorldContentReferenceConstraint<WorldContentBuiltinInput<TInput>>
    : object

type WorldContentCreatedTuple<TInput extends readonly unknown[], TOutputEntry> = Readonly<{
  [TIndex in keyof TInput]: WorldContentCreatedValue<TInput[TIndex], TOutputEntry>
}>

type WorldContentCreatedObject<
  TInput extends object,
  TOutput extends object,
> = TOutput extends unknown
  ? Readonly<{
      [TKey in keyof TInput | keyof TOutput]: TKey extends keyof TInput
        ? TKey extends keyof TOutput
          ? WorldContentCreatedValue<TInput[TKey], TOutput[TKey]>
          : TInput[TKey]
        : TKey extends keyof TOutput
          ? TOutput[TKey]
          : never
    }>
  : never

type WorldContentCreatedValue<TInput, TOutput> = TOutput extends WizImmutableValueContract
  ? TInput extends TOutput
    ? TInput
    : TOutput
  : TOutput extends readonly (infer TOutputEntry)[]
    ? TInput extends readonly unknown[]
      ? number extends TInput["length"]
        ? readonly WorldContentCreatedValue<TInput[number], TOutputEntry>[]
        : WorldContentCreatedTuple<TInput, TOutputEntry>
      : TOutput
    : TOutput extends object
      ? TInput extends object
        ? WorldContentCreatedObject<TInput, TOutput>
        : TOutput
      : TInput extends TOutput
        ? TInput
        : TOutput

export type WorldContentCreatedArrays<
  TInput extends object,
  TSchema extends WizStandardSchemaDefinition<unknown, WorldContentArrays>,
> = WorldContentCreatedValue<NormalizeWorldContentArrays<TInput>, WizStandardSchemaOutput<TSchema>>

type WorldContentCreateRuntimeOptions = {
  readonly schema: WizStandardSchemaDefinition<unknown, WorldContentArrays>
}

type WorldContentEntryId<
  TArrays extends WorldContentArrays,
  TKey extends Exclude<keyof WorldContentArrays, "facilities" | "shopDialogues" | "abilityTable">,
> = TArrays[TKey][number] extends { readonly id: infer TId extends string } ? TId : never

type WorldContentFacilityId<TArrays extends WorldContentArrays> =
  TArrays["facilities"][number] extends {
    readonly facilityId: infer TId extends string
  }
    ? TId
    : never

type WorldContentPlayerState<TArrays extends WorldContentArrays> = Omit<
  WorldSnapshotData["player"],
  "abilityIds"
> & {
  readonly abilityIds: readonly WorldContentEntryId<TArrays, "abilities">[]
}

type WorldContentPartyMemberState<TArrays extends WorldContentArrays> = Omit<
  WorldSnapshotData["partyMembers"][number],
  "abilityIds"
> & {
  readonly abilityIds: readonly WorldContentEntryId<TArrays, "abilities">[]
}

type WorldContentInventoryEntry<TArrays extends WorldContentArrays> = Omit<
  WorldSnapshotData["inventory"]["entries"][number],
  "contentId" | "contentType"
> &
  (
    | Readonly<{
        contentId: WorldContentEntryId<TArrays, "items">
        contentType: "item"
      }>
    | Readonly<{
        contentId: WorldContentEntryId<TArrays, "weapons">
        contentType: "weapon"
      }>
    | Readonly<{
        contentId: WorldContentEntryId<TArrays, "armors">
        contentType: "armor"
      }>
  )

type WorldContentInventoryState<TArrays extends WorldContentArrays> = Omit<
  WorldSnapshotData["inventory"],
  "entries"
> & {
  readonly entries: readonly WorldContentInventoryEntry<TArrays>[]
}

type WorldContentEquipmentSlotId<TArrays extends WorldContentArrays> =
  | (TArrays["weapons"][number] extends {
      readonly slotId: infer TSlotId extends string
    }
      ? TSlotId
      : never)
  | (TArrays["armors"][number] extends {
      readonly slotId: infer TSlotId extends string
    }
      ? TSlotId
      : never)

type WorldContentEquipmentState<TArrays extends WorldContentArrays> =
  WorldSnapshotData["equipment"] &
    Readonly<Partial<Record<WorldContentEquipmentSlotId<TArrays>, string | null>>>

/**
 * 特定contentと参照IDまで整合するsnapshot data。
 *
 * `WorldContent.create()`のliteral IDはplayer ability、inventory、equipment、現在stateへ
 * 伝播する。historical logは削除済みcontentのreceiptを保持できるためstringのままとする。
 * runtime parseしたcontentでは現在stateのID型もstringへ自然に広がる。
 */
export type WorldContentSnapshotData<TArrays extends WorldContentArrays = WorldContentArrays> =
  Omit<
    WorldSnapshotData,
    | "areas"
    | "equipment"
    | "inventory"
    | "npcs"
    | "partyMembers"
    | "player"
    | "quests"
    | "unlockedFacilities"
  > & {
    readonly areas: readonly (Omit<WorldSnapshotData["areas"][number], "id"> & {
      readonly id: WorldContentEntryId<TArrays, "areas">
    })[]
    readonly equipment: WorldContentEquipmentState<TArrays>
    readonly inventory: WorldContentInventoryState<TArrays>
    readonly npcs: readonly (Omit<WorldSnapshotData["npcs"][number], "id"> & {
      readonly id: WorldContentEntryId<TArrays, "npcs">
    })[]
    readonly partyMembers: readonly WorldContentPartyMemberState<TArrays>[]
    readonly player: WorldContentPlayerState<TArrays>
    readonly quests: readonly (Omit<WorldSnapshotData["quests"][number], "id"> & {
      readonly id: WorldContentEntryId<TArrays, "quests">
    })[]
    readonly unlockedFacilities: readonly WorldContentFacilityId<TArrays>[]
  }

export type WorldInitialSnapshotOptions<TArrays extends WorldContentArrays = WorldContentArrays> =
  Partial<
    Pick<
      WorldContentSnapshotData<TArrays>,
      | "player"
      | "partyMembers"
      | "inventory"
      | "equipment"
      | "time"
      | "flags"
      | "log"
      | "unlockedFacilities"
      | "isEnded"
    >
  >

const toRecord = <TEntries extends readonly { readonly id: string }[]>(
  entries: TEntries,
): WorldContentRecord<TEntries> =>
  createWizImmutableRecord(
    entries.map((entry) => [entry.id, entry] as const),
  ) as WorldContentRecord<TEntries>

const toFacilityRecord = <TEntries extends readonly { readonly facilityId: string }[]>(
  entries: TEntries,
): WorldFacilityRecord<TEntries> =>
  createWizImmutableRecord(
    entries.map((entry) => [entry.facilityId, entry] as const),
  ) as WorldFacilityRecord<TEntries>

const ownValidatedWorldContentArrays = <const TArrays extends WorldContentArrays>(
  input: TArrays,
): WorldContentReadonlyArrays<TArrays> => {
  const ownedInput = objectService.ownImmutable(input) as WorldContentReadonlyArrays<TArrays>
  const diagnostics = diagnoseWorldContent(ownedInput)
  if (diagnostics.length > 0) {
    throw new WorldContentValidationError(diagnostics)
  }
  return ownedInput
}

/**
 * World の静的 definition を、検証済み・immutable な一単位へ compile する。
 *
 * Save snapshot は保持せず、`createInitialSnapshot` で明示的に生成する。
 */
const authenticWorldContents = new WeakSet<object>()

export class WorldContent<TArrays extends WorldContentArrays = WorldContentArrays> {
  readonly arrays: WorldContentReadonlyArrays<TArrays>
  readonly items: WorldContentRecord<TArrays["items"]>
  readonly weapons: WorldContentRecord<TArrays["weapons"]>
  readonly armors: WorldContentRecord<TArrays["armors"]>
  readonly recipes: WorldContentRecord<TArrays["recipes"]>
  readonly monsters: WorldContentRecord<TArrays["monsters"]>
  readonly events: WorldContentRecord<TArrays["events"]>
  readonly areas: WorldContentRecord<TArrays["areas"]>
  readonly npcs: WorldContentRecord<TArrays["npcs"]>
  readonly quests: WorldContentRecord<TArrays["quests"]>
  readonly facilities: WorldFacilityRecord<TArrays["facilities"]>
  readonly abilities: WorldContentRecord<TArrays["abilities"]>
  readonly innPlans: WorldContentRecord<TArrays["innPlans"]>
  readonly shopDialogues: WorldContentReadonlyArrays<TArrays>["shopDialogues"]
  readonly abilityTable: WorldContentReadonlyArrays<TArrays>["abilityTable"]

  private constructor(
    token: typeof worldContentConstructorToken,
    arrays: WorldContentReadonlyArrays<TArrays>,
  ) {
    if (token !== worldContentConstructorToken) {
      throw new TypeError("WorldContent must be created with WorldContent.create() or parse()")
    }
    this.arrays = arrays
    this.items = toRecord<TArrays["items"]>(arrays.items)
    this.weapons = toRecord<TArrays["weapons"]>(arrays.weapons)
    this.armors = toRecord<TArrays["armors"]>(arrays.armors)
    this.recipes = toRecord<TArrays["recipes"]>(arrays.recipes)
    this.monsters = toRecord<TArrays["monsters"]>(arrays.monsters)
    this.events = toRecord<TArrays["events"]>(arrays.events)
    this.areas = toRecord<TArrays["areas"]>(arrays.areas)
    this.npcs = toRecord<TArrays["npcs"]>(arrays.npcs)
    this.quests = toRecord<TArrays["quests"]>(arrays.quests)
    this.facilities = toFacilityRecord<TArrays["facilities"]>(arrays.facilities)
    this.abilities = toRecord<TArrays["abilities"]>(arrays.abilities)
    this.innPlans = toRecord<TArrays["innPlans"]>(arrays.innPlans)
    this.shopDialogues = arrays.shopDialogues
    this.abilityTable = arrays.abilityTable
    authenticWorldContents.add(this)
    Object.freeze(this)
  }

  /**
   * JSON など `unknown` の標準 content を runtime schema で parse する。
   */
  static parse<const TSchema extends WizStandardSchemaDefinition<unknown, WorldContentArrays>>(
    input: unknown,
    options: WorldContentSchemaOptions<TSchema>,
  ): WorldContent<WizStandardSchemaOutput<TSchema>>
  static parse(input: unknown): WorldContent
  static parse(
    input: unknown,
    options?: WorldContentSchemaOptions<WizStandardSchemaDefinition<unknown, WorldContentArrays>>,
  ): WorldContent {
    if (options) {
      return new WorldContent(
        worldContentConstructorToken,
        ownValidatedWorldContentArrays(
          WizStandardSchema.capture(options.schema, "World content schema").validate(input),
        ),
      )
    }

    return new WorldContent(
      worldContentConstructorToken,
      ownValidatedWorldContentArrays(worldContentSchema.validate(input)),
    )
  }

  /** @internal world composition boundary only. */
  static require(value: unknown, label: string): void {
    if (typeof value !== "object" || value === null || !authenticWorldContents.has(value)) {
      throw new TypeError(`${label} must be created with WorldContent.create() or parse()`)
    }
  }

  /**
   * 型付け済みの標準definitionからliteral IDを保持したcontentを作る。
   */
  static create<const TInput extends WorldContentArraysInput>(
    input: TInput,
    ...validation: TInput extends WorldContentStandardInputConstraint<TInput> &
      WorldContentReferenceConstraint<TInput>
      ? []
      : [never]
  ): WorldContent<NormalizeWorldContentArrays<TInput>>
  /**
   * 独自category / fieldを含む型付け済みdefinitionを明示schemaで検証する。
   */
  static create<
    const TInput extends object,
    const TSchema extends WizStandardSchemaDefinition<unknown, WorldContentArrays>,
  >(
    input: TInput,
    options: WorldContentCreateOptions<TSchema>,
    ...validation: TInput extends WizDeepReadonly<WizStandardSchemaInput<TSchema>> &
      WorldContentCreateReferenceConstraint<TInput>
      ? []
      : [never]
  ): WorldContent<WorldContentCreatedArrays<TInput, TSchema>>
  static create(
    input: unknown,
    options?: WorldContentCreateRuntimeOptions,
    ...validation: never[]
  ): WorldContent {
    void validation
    const arrays = options
      ? WizStandardSchema.capture(options.schema, "World content schema").validate(input)
      : worldContentSchema.validate(input)
    const standardCategories = Object.keys(zWorldContentArrays.shape)

    WorldContentCreateValidation.assertCanonical(input, arrays, standardCategories)

    return new WorldContent(worldContentConstructorToken, ownValidatedWorldContentArrays(arrays))
  }

  createInitialSnapshot(
    options: WorldInitialSnapshotOptions<TArrays> = {},
  ): WorldSnapshot<WorldContentSnapshotData<TArrays>> {
    const snapshot = WorldSnapshot.create({
      player: options.player ?? WORLD_DEFAULT_INITIAL_PLAYER,
      partyMembers: options.partyMembers ?? [],
      inventory: options.inventory ?? WIZ_STANDARD_DEFAULT_INVENTORY,
      equipment: options.equipment ?? createInitialEquipment(this.arrays),
      time: options.time ?? WIZ_VAULT_DEFAULT_TIME,
      areas: this.arrays.areas.map((area) => ({
        id: area.id,
        progress: 0,
        unlocked: area.unlocked,
      })),
      npcs: this.arrays.npcs.map((npc) => ({
        id: npc.id,
        affinity: npc.initialAffinity,
      })),
      quests: this.arrays.quests.map((quest) => ({
        id: quest.id,
        accepted: false,
        completed: false,
        ...(quest.objective.type === "defeat" || quest.objective.type === "gather"
          ? { progress: 0 }
          : {}),
      })),
      flags: options.flags ?? [],
      log: options.log ?? [{ key: "WORLD_STARTED" }],
      unlockedFacilities: options.unlockedFacilities ?? [],
      isEnded: options.isEnded ?? false,
    })
    return this.validateSnapshot(snapshot)
  }

  readonly validateSnapshot = (
    input: unknown,
  ): WorldSnapshot<WorldContentSnapshotData<TArrays>> => {
    const snapshot = WorldSnapshot.fromUnknown(input)
    const diagnostics = diagnoseWorldSnapshot(this.arrays, snapshot.toPlain())
    if (diagnostics.length > 0) {
      throw new WorldSnapshotValidationError(diagnostics)
    }
    return snapshot as WorldSnapshot<WorldContentSnapshotData<TArrays>>
  }

  reconcileSnapshot(
    input: unknown,
    policy: "drop" | "error",
  ): WorldSnapshot<WorldContentSnapshotData<TArrays>>
  reconcileSnapshot(
    input: unknown,
    policy: "keep" | Exclude<WorldSnapshotReconcilePolicy, WorldSnapshotOrphanPolicy>,
  ): WorldSnapshot
  reconcileSnapshot(input: unknown, policy: WorldSnapshotReconcilePolicy): WorldSnapshot
  reconcileSnapshot(input: unknown, policy: WorldSnapshotReconcilePolicy): WorldSnapshot {
    return reconcileWorldSnapshot(this.arrays, input, policy)
  }

  getItem<TId extends TArrays["items"][number]["id"]>(
    id: TId,
  ): EntryLookupResult<TArrays["items"], TId> {
    return getWizImmutableRecordValue(this.items, id) as EntryLookupResult<TArrays["items"], TId>
  }

  getWeapon<TId extends TArrays["weapons"][number]["id"]>(
    id: TId,
  ): EntryLookupResult<TArrays["weapons"], TId> {
    return getWizImmutableRecordValue(this.weapons, id) as EntryLookupResult<
      TArrays["weapons"],
      TId
    >
  }

  getArmor<TId extends TArrays["armors"][number]["id"]>(
    id: TId,
  ): EntryLookupResult<TArrays["armors"], TId> {
    return getWizImmutableRecordValue(this.armors, id) as EntryLookupResult<TArrays["armors"], TId>
  }

  getRecipe<TId extends TArrays["recipes"][number]["id"]>(
    id: TId,
  ): EntryLookupResult<TArrays["recipes"], TId> {
    return getWizImmutableRecordValue(this.recipes, id) as EntryLookupResult<
      TArrays["recipes"],
      TId
    >
  }

  getMonster<TId extends TArrays["monsters"][number]["id"]>(
    id: TId,
  ): EntryLookupResult<TArrays["monsters"], TId> {
    return getWizImmutableRecordValue(this.monsters, id) as EntryLookupResult<
      TArrays["monsters"],
      TId
    >
  }

  getEvent<TId extends TArrays["events"][number]["id"]>(
    id: TId,
  ): EntryLookupResult<TArrays["events"], TId> {
    return getWizImmutableRecordValue(this.events, id) as EntryLookupResult<TArrays["events"], TId>
  }

  getArea<TId extends TArrays["areas"][number]["id"]>(
    id: TId,
  ): EntryLookupResult<TArrays["areas"], TId> {
    return getWizImmutableRecordValue(this.areas, id) as EntryLookupResult<TArrays["areas"], TId>
  }

  getNpc<TId extends TArrays["npcs"][number]["id"]>(
    id: TId,
  ): EntryLookupResult<TArrays["npcs"], TId> {
    return getWizImmutableRecordValue(this.npcs, id) as EntryLookupResult<TArrays["npcs"], TId>
  }

  getQuest<TId extends TArrays["quests"][number]["id"]>(
    id: TId,
  ): EntryLookupResult<TArrays["quests"], TId> {
    return getWizImmutableRecordValue(this.quests, id) as EntryLookupResult<TArrays["quests"], TId>
  }

  getFacility<TId extends TArrays["facilities"][number]["facilityId"]>(
    id: TId,
  ): FacilityLookupResult<TArrays["facilities"], TId> {
    return getWizImmutableRecordValue(this.facilities, id) as FacilityLookupResult<
      TArrays["facilities"],
      TId
    >
  }

  getAbility<TId extends TArrays["abilities"][number]["id"]>(
    id: TId,
  ): EntryLookupResult<TArrays["abilities"], TId> {
    return getWizImmutableRecordValue(this.abilities, id) as EntryLookupResult<
      TArrays["abilities"],
      TId
    >
  }

  getInnPlan<TId extends TArrays["innPlans"][number]["id"]>(
    id: TId,
  ): EntryLookupResult<TArrays["innPlans"], TId> {
    return getWizImmutableRecordValue(this.innPlans, id) as EntryLookupResult<
      TArrays["innPlans"],
      TId
    >
  }
}

Object.freeze(WorldContent.prototype)
Object.freeze(WorldContent)
