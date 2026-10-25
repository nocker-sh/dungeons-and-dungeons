import type { WizDeepReadonly } from "@/lib/wiz/core/immutable-value"
import { WizObjectService } from "@/lib/wiz/core/services/wiz-object-service"
import {
  WizStandardSchema,
  type WizStandardSchemaDefinition,
  type WizStandardSchemaOutput,
} from "@/lib/wiz/core/standard-schema"

const objectService = new WizObjectService()
const wizContentCatalogConstructorToken = Symbol("WizContentCatalog.constructor")

export type WizContentCatalogEntry = Readonly<{
  id: string
}>

export type WizContentCatalogCategories = Readonly<
  Record<string, readonly WizContentCatalogEntry[]>
>

export type WizContentCatalogReadonlyCategories<TCategories extends WizContentCatalogCategories> =
  WizDeepReadonly<TCategories>

export type WizContentCatalogCategoryName<TCategories extends WizContentCatalogCategories> =
  Extract<keyof TCategories, string>

export type WizContentCatalogCategoryEntries<
  TCategories extends WizContentCatalogCategories,
  TCategory extends WizContentCatalogCategoryName<TCategories>,
> = TCategories[TCategory]

export type WizContentCatalogCategoryId<TEntries extends readonly WizContentCatalogEntry[]> =
  TEntries[number]["id"]

export type WizContentCatalogId<
  TCategories extends WizContentCatalogCategories,
  TCategory extends WizContentCatalogCategoryName<TCategories>,
> = WizContentCatalogCategoryId<WizContentCatalogCategoryEntries<TCategories, TCategory>>

export type WizContentCatalogReferenceSelection<TId extends string> =
  | TId
  | null
  | undefined
  | readonly WizContentCatalogReferenceSelection<TId>[]

type WizContentCatalogEntryForId<
  TEntries extends readonly WizContentCatalogEntry[],
  TId extends string,
> = TEntries[number] extends infer TEntry
  ? TEntry extends { readonly id: infer TEntryId extends string }
    ? TId extends TEntryId
      ? TEntry
      : never
    : never
  : never

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

type WizContentCatalogTupleIndex<TEntries extends readonly WizContentCatalogEntry[]> = Exclude<
  Extract<Exclude<keyof TEntries, keyof (readonly WizContentCatalogEntry[])>, `${bigint}`>,
  `-${string}`
>

type WizContentCatalogDefiniteEntryId<TEntry> = [TEntry] extends [
  Readonly<{ id: infer TId extends string }>,
]
  ? IsSingleStringLiteral<TId> extends true
    ? TId
    : never
  : never

type WizContentCatalogDefiniteId<TEntries extends readonly WizContentCatalogEntry[]> =
  number extends TEntries["length"]
    ? never
    : {
        [TIndex in WizContentCatalogTupleIndex<TEntries>]: WizContentCatalogDefiniteEntryId<
          TEntries[TIndex]
        >
      }[WizContentCatalogTupleIndex<TEntries>]

type WizContentCatalogCheckedId<
  TCandidate extends string,
  TAllowed extends string,
> = string extends TCandidate ? TAllowed : TCandidate extends TAllowed ? TCandidate : never

type WizContentCatalogCheckedIdInput<
  TCandidate extends string,
  TAllowed extends string,
> = TCandidate extends TAllowed ? TCandidate : string extends TCandidate ? TCandidate : never

type WizContentCatalogLookupResult<
  TEntries extends readonly WizContentCatalogEntry[],
  TCategory extends string,
  TCandidate extends string,
  TAllowed extends string = WizContentCatalogCategoryId<TEntries>,
> = string extends TCandidate
  ?
      | WizDeepReadonly<
          WizContentCatalogEntryForId<TEntries, WizContentCatalogCheckedId<TCandidate, TAllowed>>
        >
      | undefined
  : IsSingleStringLiteral<TCategory> extends true
    ? [WizContentCatalogCheckedId<TCandidate, TAllowed>] extends [
        WizContentCatalogDefiniteId<TEntries>,
      ]
      ? WizDeepReadonly<
          WizContentCatalogEntryForId<TEntries, WizContentCatalogCheckedId<TCandidate, TAllowed>>
        >
      :
          | WizDeepReadonly<
              WizContentCatalogEntryForId<
                TEntries,
                WizContentCatalogCheckedId<TCandidate, TAllowed>
              >
            >
          | undefined
    :
        | WizDeepReadonly<
            WizContentCatalogEntryForId<TEntries, WizContentCatalogCheckedId<TCandidate, TAllowed>>
          >
        | undefined

export type WizContentCatalogSchemaOptions<
  TSchema extends WizStandardSchemaDefinition<unknown, WizContentCatalogCategories>,
> = Readonly<{
  /**
   * parse中に変更しない、信頼済みの純粋なvalidation dependency。
   * catalogはStandard Schemaのvalidator参照だけを構築時に捕捉する。
   */
  schema: TSchema
}>

export type WizContentCatalogReferenceRuleDefinition<
  TCategories extends WizContentCatalogCategories,
  TSource extends WizContentCatalogCategoryName<TCategories>,
  TTarget extends WizContentCatalogCategoryName<TCategories>,
> = Readonly<{
  source: TSource
  target: TTarget
  select: (
    entry: WizDeepReadonly<WizContentCatalogCategoryEntries<TCategories, TSource>[number]>,
  ) => WizContentCatalogReferenceSelection<WizContentCatalogId<TCategories, TTarget>>
  path: string
}>

export type WizContentCatalogDiagnostic =
  | Readonly<{
      code: "invalid_category_property"
      property: string
      path: string
      message: string
    }>
  | Readonly<{
      code: "non_canonical_category"
      category: string
      path: string
      message: string
    }>
  | Readonly<{
      code: "invalid_category"
      category: string
      path: string
      message: string
    }>
  | Readonly<{
      code: "invalid_category_entry"
      category: string
      path: string
      message: string
    }>
  | Readonly<{
      code: "invalid_category_entries_property"
      category: string
      property: string
      path: string
      message: string
    }>
  | Readonly<{
      code: "invalid_id"
      category: string
      path: string
      message: string
    }>
  | Readonly<{
      code: "empty_id"
      category: string
      id: string
      path: string
      message: string
    }>
  | Readonly<{
      code: "non_canonical_id"
      category: string
      id: string
      path: string
      message: string
    }>
  | Readonly<{
      code: "duplicate_id"
      category: string
      id: string
      path: string
      firstPath: string
      message: string
    }>

export type WizContentCatalogReferenceDiagnostic =
  | Readonly<{
      code: "invalid_reference_rule"
      path: string
      message: string
    }>
  | Readonly<{
      code: "missing_category"
      role: "source" | "target"
      category: string
      path: string
      message: string
    }>
  | Readonly<{
      code: "invalid_reference"
      source: string
      target: string
      sourceId: string
      path: string
      message: string
    }>
  | Readonly<{
      code: "missing_reference"
      source: string
      target: string
      sourceId: string
      id: string
      path: string
      message: string
    }>
  | Readonly<{
      code: "wrong_category_reference"
      source: string
      target: string
      sourceId: string
      id: string
      actualCategories: readonly string[]
      path: string
      message: string
    }>

const categoryPath = (category: string): string =>
  /^[A-Z_$][\w$]*$/i.test(category) ? `$.${category}` : `$[${JSON.stringify(category)}]`

const freezeDiagnostic = (diagnostic: WizContentCatalogDiagnostic): WizContentCatalogDiagnostic =>
  Object.freeze(diagnostic)

const referencePath = (entryPath: string, path: string): string =>
  path.startsWith("[") ? `${entryPath}${path}` : `${entryPath}.${path}`

const ownReferenceDiagnostics = (
  diagnostics: readonly WizContentCatalogReferenceDiagnostic[],
): readonly WizContentCatalogReferenceDiagnostic[] => objectService.ownImmutable(diagnostics)

/**
 * Category名に意味を仮定せず、各category内のID不変条件だけを検証する。
 */
export const diagnoseWizContentCatalog = (
  categories: Readonly<Record<string, unknown>>,
): readonly WizContentCatalogDiagnostic[] => {
  const diagnostics: WizContentCatalogDiagnostic[] = []

  for (const categoryKey of Reflect.ownKeys(categories)) {
    if (typeof categoryKey !== "string") {
      diagnostics.push({
        code: "invalid_category_property",
        property: String(categoryKey),
        path: "$",
        message: `Content catalog symbol property ${String(categoryKey)} is not a category`,
      })
      continue
    }
    const descriptor = Object.getOwnPropertyDescriptor(categories, categoryKey)
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) {
      diagnostics.push({
        code: "invalid_category_property",
        property: categoryKey,
        path: categoryPath(categoryKey),
        message: `Content category "${categoryKey}" must be an enumerable data property`,
      })
      continue
    }

    const category = categoryKey
    const unknownEntries = descriptor.value
    const path = categoryPath(category)
    if (category.trim().length === 0 || category !== category.trim()) {
      diagnostics.push({
        code: "non_canonical_category",
        category,
        path,
        message: `Content category "${category}" must not be blank or have surrounding whitespace`,
      })
    }
    if (!Array.isArray(unknownEntries)) {
      diagnostics.push({
        code: "invalid_category",
        category,
        path,
        message: `Content category "${category}" must be an array`,
      })
      continue
    }

    for (const entryKey of Reflect.ownKeys(unknownEntries)) {
      if (entryKey === "length") {
        continue
      }
      const isCanonicalIndex =
        typeof entryKey === "string" &&
        /^(0|[1-9][0-9]*)$/.test(entryKey) &&
        Number(entryKey) < unknownEntries.length
      if (!isCanonicalIndex) {
        diagnostics.push({
          code: "invalid_category_entries_property",
          category,
          property: String(entryKey),
          path,
          message: `Content category "${category}" array property ${String(entryKey)} is not an entry index`,
        })
      }
    }

    const firstPathById = new Map<string, string>()
    for (let index = 0; index < unknownEntries.length; index += 1) {
      const entryDescriptor = Object.getOwnPropertyDescriptor(unknownEntries, String(index))
      if (!entryDescriptor || !entryDescriptor.enumerable || !("value" in entryDescriptor)) {
        diagnostics.push({
          code: "invalid_category_entry",
          category,
          path: `${path}[${index}]`,
          message: `Content entry at "${path}[${index}]" must be an enumerable data property`,
        })
        continue
      }
      const unknownEntry = entryDescriptor.value
      const idPath = `${path}[${index}].id`
      const idDescriptor =
        typeof unknownEntry === "object" && unknownEntry !== null
          ? Object.getOwnPropertyDescriptor(unknownEntry, "id")
          : undefined
      if (
        !idDescriptor ||
        !idDescriptor.enumerable ||
        !("value" in idDescriptor) ||
        typeof idDescriptor.value !== "string"
      ) {
        diagnostics.push({
          code: "invalid_id",
          category,
          path: idPath,
          message: `Content ID at "${idPath}" must be a string`,
        })
        continue
      }

      const id = idDescriptor.value
      if (id.trim().length === 0) {
        diagnostics.push({
          code: "empty_id",
          category,
          id,
          path: idPath,
          message: `Content ID at "${idPath}" must not be empty`,
        })
      } else if (id !== id.trim()) {
        diagnostics.push({
          code: "non_canonical_id",
          category,
          id,
          path: idPath,
          message: `Content ID "${id}" at "${idPath}" must not have surrounding whitespace`,
        })
      }

      const firstPath = firstPathById.get(id)
      if (firstPath) {
        diagnostics.push({
          code: "duplicate_id",
          category,
          id,
          path: idPath,
          firstPath,
          message: `Duplicate content ID "${id}" in category "${category}"`,
        })
      } else {
        firstPathById.set(id, idPath)
      }
    }
  }

  return Object.freeze(diagnostics.map(freezeDiagnostic))
}

export class WizContentCatalogValidationError extends Error {
  override readonly name = "WizContentCatalogValidationError"
  readonly diagnostics: readonly WizContentCatalogDiagnostic[]

  constructor(diagnostics: readonly WizContentCatalogDiagnostic[]) {
    const ownedDiagnostics = objectService.ownImmutable(diagnostics)
    super(
      `Content catalog validation failed with ${ownedDiagnostics.length} diagnostic${
        ownedDiagnostics.length === 1 ? "" : "s"
      }`,
    )
    this.diagnostics = ownedDiagnostics
    Object.freeze(this)
  }
}

export class WizContentCatalogReferenceValidationError extends Error {
  override readonly name = "WizContentCatalogReferenceValidationError"
  readonly diagnostics: readonly WizContentCatalogReferenceDiagnostic[]

  constructor(diagnostics: readonly WizContentCatalogReferenceDiagnostic[]) {
    const ownedDiagnostics = ownReferenceDiagnostics(diagnostics)
    super(
      `Content catalog reference validation failed with ${ownedDiagnostics.length} diagnostic${
        ownedDiagnostics.length === 1 ? "" : "s"
      }`,
    )
    this.diagnostics = ownedDiagnostics
    Object.freeze(this)
  }
}

export class WizContentCatalogCategoryNotFoundError extends Error {
  override readonly name = "WizContentCatalogCategoryNotFoundError"
  readonly category: string
  readonly path: string

  constructor(category: string) {
    super(`Content category "${category}" was not found`)
    this.category = category
    this.path = categoryPath(category)
    Object.freeze(this)
  }
}

export class WizContentCatalogEntryNotFoundError extends Error {
  override readonly name = "WizContentCatalogEntryNotFoundError"
  readonly category: string
  readonly id: string
  readonly path: string

  constructor(category: string, id: string) {
    super(`Content ID "${id}" was not found in category "${category}"`)
    this.category = category
    this.id = id
    this.path = `${categoryPath(category)}[id=${JSON.stringify(id)}]`
    Object.freeze(this)
  }
}

/**
 * category間参照を表すimmutable rule。
 *
 * selectorは入力を変更しない純粋関数として扱い、rule自身が所有する凍結済みwrapper内に保持する。
 */
export class WizContentCatalogReferenceRule<
  TCategories extends WizContentCatalogCategories,
  TSource extends WizContentCatalogCategoryName<TCategories>,
  TTarget extends WizContentCatalogCategoryName<TCategories>,
> {
  readonly source: TSource
  readonly target: TTarget
  readonly path: string
  private readonly selectValue: (entry: unknown) => unknown

  constructor(definition: WizContentCatalogReferenceRuleDefinition<TCategories, TSource, TTarget>) {
    this.source = definition.source
    this.target = definition.target
    this.path = definition.path
    const select = definition.select
    this.selectValue = Object.freeze((entry: unknown): unknown =>
      select(
        entry as WizDeepReadonly<WizContentCatalogCategoryEntries<TCategories, TSource>[number]>,
      ),
    )
    Object.freeze(this)
  }

  select(entry: unknown): unknown {
    return this.selectValue(entry)
  }
}

/**
 * `validateReferences(refs => [...])`内で、catalog固有のcategory/ID型をselectorへ伝える。
 */
export class WizContentCatalogReferenceRules<TCategories extends WizContentCatalogCategories> {
  constructor() {
    Object.freeze(this)
  }

  define<
    const TSource extends WizContentCatalogCategoryName<TCategories>,
    const TTarget extends WizContentCatalogCategoryName<TCategories>,
  >(
    definition: WizContentCatalogReferenceRuleDefinition<TCategories, TSource, TTarget>,
  ): WizContentCatalogReferenceRule<TCategories, TSource, TTarget> {
    return new WizContentCatalogReferenceRule(definition)
  }
}

type WizContentCatalogAnyReferenceRule<TCategories extends WizContentCatalogCategories> =
  WizContentCatalogReferenceRule<
    TCategories,
    WizContentCatalogCategoryName<TCategories>,
    WizContentCatalogCategoryName<TCategories>
  >

const ownValidatedWizContentCatalogCategories = <TCategories extends WizContentCatalogCategories>(
  input: TCategories,
): WizContentCatalogReadonlyCategories<TCategories> => {
  const inputDiagnostics = diagnoseWizContentCatalog(input)
  if (inputDiagnostics.length > 0) {
    throw new WizContentCatalogValidationError(inputDiagnostics)
  }
  const categories: WizContentCatalogReadonlyCategories<TCategories> =
    objectService.ownImmutable(input)
  const diagnostics = diagnoseWizContentCatalog(categories)
  if (diagnostics.length > 0) {
    throw new WizContentCatalogValidationError(diagnostics)
  }
  return categories
}

/**
 * RPG固有のcategoryを仮定しない、型付き静的content catalog。
 *
 * TypeScript入力は`create`、JSONなどの外部入力はStandard Schema付き`parse`を使う。
 */
export class WizContentCatalog<
  TCategories extends WizContentCatalogCategories = WizContentCatalogCategories,
> {
  readonly categories: TCategories

  private constructor(token: typeof wizContentCatalogConstructorToken, categories: TCategories) {
    if (token !== wizContentCatalogConstructorToken) {
      throw new TypeError(
        "WizContentCatalog must be created with WizContentCatalog.create() or parse()",
      )
    }
    this.categories = categories
    Object.freeze(this)
  }

  static create<const TCategories extends WizContentCatalogCategories>(
    input: TCategories,
  ): WizContentCatalog<WizContentCatalogReadonlyCategories<TCategories>> {
    return new WizContentCatalog(
      wizContentCatalogConstructorToken,
      ownValidatedWizContentCatalogCategories(input),
    )
  }

  static parse<
    const TSchema extends WizStandardSchemaDefinition<unknown, WizContentCatalogCategories>,
  >(
    input: unknown,
    options: WizContentCatalogSchemaOptions<TSchema>,
  ): WizContentCatalog<WizContentCatalogReadonlyCategories<WizStandardSchemaOutput<TSchema>>> {
    return new WizContentCatalog(
      wizContentCatalogConstructorToken,
      ownValidatedWizContentCatalogCategories(
        WizStandardSchema.capture(options.schema, "Content catalog schema").validate(input),
      ),
    )
  }

  list<const TCategory extends WizContentCatalogCategoryName<TCategories>>(
    category: TCategory,
  ): WizDeepReadonly<WizContentCatalogCategoryEntries<TCategories, TCategory>> {
    if (!Object.hasOwn(this.categories, category)) {
      throw new WizContentCatalogCategoryNotFoundError(category)
    }
    return this.categories[category] as WizDeepReadonly<
      WizContentCatalogCategoryEntries<TCategories, TCategory>
    >
  }

  get<
    const TCategory extends WizContentCatalogCategoryName<TCategories>,
    const TCandidate extends string,
  >(
    category: TCategory,
    id: WizContentCatalogCheckedIdInput<TCandidate, WizContentCatalogId<TCategories, TCategory>>,
  ): WizContentCatalogLookupResult<
    WizContentCatalogCategoryEntries<TCategories, TCategory>,
    TCategory,
    TCandidate
  > {
    return this.list(category).find((entry) => entry.id === id) as WizContentCatalogLookupResult<
      WizContentCatalogCategoryEntries<TCategories, TCategory>,
      TCategory,
      TCandidate
    >
  }

  require<
    const TCategory extends WizContentCatalogCategoryName<TCategories>,
    const TCandidate extends string,
  >(
    category: TCategory,
    id: WizContentCatalogCheckedIdInput<TCandidate, WizContentCatalogId<TCategories, TCategory>>,
  ): WizDeepReadonly<
    WizContentCatalogEntryForId<
      WizContentCatalogCategoryEntries<TCategories, TCategory>,
      WizContentCatalogCheckedId<TCandidate, WizContentCatalogId<TCategories, TCategory>>
    >
  > {
    const entry = this.list(category).find((candidate) => candidate.id === id)
    if (!entry) {
      throw new WizContentCatalogEntryNotFoundError(category, id)
    }
    return entry as WizDeepReadonly<
      WizContentCatalogEntryForId<
        WizContentCatalogCategoryEntries<TCategories, TCategory>,
        WizContentCatalogCheckedId<TCandidate, WizContentCatalogId<TCategories, TCategory>>
      >
    >
  }

  has<const TCategory extends WizContentCatalogCategoryName<TCategories>>(
    category: TCategory,
    id: string,
  ): id is WizContentCatalogId<TCategories, TCategory> {
    return this.list(category).some((entry) => entry.id === id)
  }

  /**
   * category間参照を全件診断する。selectorが返すreadonly配列は任意の深さにできる。
   */
  diagnoseReferences(
    configure: (
      references: WizContentCatalogReferenceRules<TCategories>,
    ) => readonly WizContentCatalogAnyReferenceRule<TCategories>[],
  ): readonly WizContentCatalogReferenceDiagnostic[] {
    const configured: unknown = configure(new WizContentCatalogReferenceRules<TCategories>())
    if (!Array.isArray(configured)) {
      return ownReferenceDiagnostics([
        {
          code: "invalid_reference_rule",
          path: "$references",
          message: "Content reference configuration must return an array of rules",
        },
      ])
    }

    const diagnostics: WizContentCatalogReferenceDiagnostic[] = []
    for (const [ruleIndex, unknownRule] of configured.entries()) {
      const ruleDeclarationPath = `$references[${ruleIndex}]`
      if (!(unknownRule instanceof WizContentCatalogReferenceRule)) {
        diagnostics.push({
          code: "invalid_reference_rule",
          path: ruleDeclarationPath,
          message: `Content reference rule at "${ruleDeclarationPath}" is invalid`,
        })
        continue
      }

      const source = unknownRule.source
      const target = unknownRule.target
      const path = unknownRule.path
      if (
        typeof source !== "string" ||
        typeof target !== "string" ||
        typeof path !== "string" ||
        path.trim().length === 0 ||
        path !== path.trim()
      ) {
        diagnostics.push({
          code: "invalid_reference_rule",
          path: ruleDeclarationPath,
          message: `Content reference rule at "${ruleDeclarationPath}" must have string categories and a canonical non-empty path`,
        })
        continue
      }

      const sourceExists = Object.hasOwn(this.categories, source)
      const targetExists = Object.hasOwn(this.categories, target)
      if (!sourceExists) {
        diagnostics.push({
          code: "missing_category",
          role: "source",
          category: source,
          path: `${ruleDeclarationPath}.source`,
          message: `Source content category "${source}" was not found`,
        })
      }
      if (!targetExists) {
        diagnostics.push({
          code: "missing_category",
          role: "target",
          category: target,
          path: `${ruleDeclarationPath}.target`,
          message: `Target content category "${target}" was not found`,
        })
      }
      if (!sourceExists || !targetExists) {
        continue
      }

      const sourceEntries = this.categories[source]
      const targetEntries = this.categories[target]
      if (!sourceEntries || !targetEntries) {
        continue
      }

      for (const [entryIndex, entry] of sourceEntries.entries()) {
        const entryPath = `${categoryPath(source)}[${entryIndex}]`
        const selectedPath = referencePath(entryPath, path)
        try {
          const selected = unknownRule.select(entry)
          this.diagnoseReferenceSelection({
            diagnostics,
            entryId: entry.id,
            path: selectedPath,
            selected,
            source,
            target,
            targetEntries,
          })
        } catch (error) {
          const detail = error instanceof Error ? `: ${error.message}` : ""
          diagnostics.push({
            code: "invalid_reference",
            source,
            target,
            sourceId: entry.id,
            path: selectedPath,
            message: `Reference selector failed at "${selectedPath}"${detail}`,
          })
        }
      }
    }

    return ownReferenceDiagnostics(diagnostics)
  }

  /**
   * 参照がすべて有効なら同じimmutable catalogを返し、問題があれば集約errorを投げる。
   */
  validateReferences(
    configure: (
      references: WizContentCatalogReferenceRules<TCategories>,
    ) => readonly WizContentCatalogAnyReferenceRule<TCategories>[],
  ): this {
    const diagnostics = this.diagnoseReferences(configure)
    if (diagnostics.length > 0) {
      throw new WizContentCatalogReferenceValidationError(diagnostics)
    }
    return this
  }

  private diagnoseReferenceSelection(options: {
    diagnostics: WizContentCatalogReferenceDiagnostic[]
    entryId: string
    path: string
    selected: unknown
    source: string
    target: string
    targetEntries: readonly WizContentCatalogEntry[]
  }): void {
    const ancestors = new WeakSet<object>()

    const visit = (selected: unknown, path: string): void => {
      if (selected === undefined || selected === null) {
        return
      }
      if (Array.isArray(selected)) {
        if (ancestors.has(selected)) {
          options.diagnostics.push({
            code: "invalid_reference",
            source: options.source,
            target: options.target,
            sourceId: options.entryId,
            path,
            message: `Reference selection at "${path}" must not be cyclic`,
          })
          return
        }
        ancestors.add(selected)
        for (const [index, nested] of selected.entries()) {
          visit(nested, `${path}[${index}]`)
        }
        ancestors.delete(selected)
        return
      }
      if (
        typeof selected !== "string" ||
        selected.trim().length === 0 ||
        selected !== selected.trim()
      ) {
        options.diagnostics.push({
          code: "invalid_reference",
          source: options.source,
          target: options.target,
          sourceId: options.entryId,
          path,
          message: `Reference at "${path}" must be a canonical non-empty string`,
        })
        return
      }
      if (options.targetEntries.some((entry) => entry.id === selected)) {
        return
      }

      const actualCategories = Object.entries(this.categories)
        .filter(([, entries]) => entries.some((entry) => entry.id === selected))
        .map(([category]) => category)
      if (actualCategories.length > 0) {
        options.diagnostics.push({
          code: "wrong_category_reference",
          source: options.source,
          target: options.target,
          sourceId: options.entryId,
          id: selected,
          actualCategories,
          path,
          message: `Content ID "${selected}" at "${path}" belongs to ${actualCategories
            .map((category) => `"${category}"`)
            .join(", ")}, not "${options.target}"`,
        })
        return
      }

      options.diagnostics.push({
        code: "missing_reference",
        source: options.source,
        target: options.target,
        sourceId: options.entryId,
        id: selected,
        path,
        message: `Content ID "${selected}" at "${path}" was not found in category "${options.target}"`,
      })
    }

    visit(options.selected, options.path)
  }
}

Object.freeze(WizContentCatalogValidationError.prototype)
Object.freeze(WizContentCatalogValidationError)
Object.freeze(WizContentCatalogReferenceValidationError.prototype)
Object.freeze(WizContentCatalogReferenceValidationError)
Object.freeze(WizContentCatalogCategoryNotFoundError.prototype)
Object.freeze(WizContentCatalogCategoryNotFoundError)
Object.freeze(WizContentCatalogEntryNotFoundError.prototype)
Object.freeze(WizContentCatalogEntryNotFoundError)
Object.freeze(WizContentCatalogReferenceRule.prototype)
Object.freeze(WizContentCatalogReferenceRule)
Object.freeze(WizContentCatalogReferenceRules.prototype)
Object.freeze(WizContentCatalogReferenceRules)
Object.freeze(WizContentCatalog.prototype)
Object.freeze(WizContentCatalog)
