import { z } from "zod"
import { describe, expect, expectTypeOf, it } from "vite-plus/test"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import {
  WizContentCatalog,
  WizContentCatalogCategoryNotFoundError,
  WizContentCatalogEntryNotFoundError,
  WizContentCatalogReferenceValidationError,
  WizContentCatalogValidationError,
} from "@/lib/wiz/core/content/wiz-content-catalog"
import {
  type WizStandardSchemaDefinition,
  WizStandardSchemaValidationError,
} from "@/lib/wiz/core/standard-schema"

describe("WizContentCatalog", () => {
  it("内部validation helperを公開せずconstructorのruntime迂回を拒否する", () => {
    expect(Object.hasOwn(WizContentCatalog, "fromValidatedCategories")).toBe(
      false
    )
    expect(() =>
      Reflect.construct(WizContentCatalog, [{ spells: [{ id: "ember" }] }])
    ).toThrow(TypeError)
  })

  it("任意categoryとliteral IDを保ったimmutable catalogを作る", () => {
    const sourceTags = ["fire"]
    const input = {
      spells: [
        { id: "ember" as const, cost: 2, tags: sourceTags },
        { id: "frost" as const, cost: 3, tags: ["ice"] },
      ],
      factions: [{ id: "dawn" as const, reputationFloor: -10 }],
    } as const
    const catalog = WizContentCatalog.create(input)

    expect(catalog.list("spells").map((spell) => spell.id)).toEqual([
      "ember",
      "frost",
    ])
    expect(catalog.get("spells", "ember").cost).toBe(2)
    expect(catalog.require("factions", "dawn").reputationFloor).toBe(-10)
    expect(catalog.require("spells", "frost").tags).toEqual(["ice"])
    expect(Object.isFrozen(catalog)).toBe(true)
    expect(Object.isFrozen(catalog.categories)).toBe(true)
    expect(Object.isFrozen(catalog.categories.spells)).toBe(true)
    expect(Object.isFrozen(catalog.categories.spells[0])).toBe(true)
    expect(Object.isFrozen(catalog.categories.spells[0]?.tags)).toBe(true)
    expect(Object.isFrozen(input)).toBe(false)
    expect(Object.isFrozen(input.spells[0])).toBe(false)

    sourceTags.push("mutable-source")
    expect(catalog.require("spells", "ember").tags).toEqual(["fire"])

    const verifyLiteralTypes = () => {
      // @ts-expect-error 存在しないcategoryは許可しない
      catalog.list("items")
      // @ts-expect-error categoryに存在しないIDは許可しない
      catalog.get("spells", "dawn")
      // @ts-expect-error 別categoryのIDは許可しない
      catalog.require("factions", "ember")
    }
    void verifyLiteralTypes
  })

  it("hasで外部stringをcategory固有のIDへ絞り込む", () => {
    const catalog = WizContentCatalog.create({
      spells: [
        { id: "ember", cost: 2 },
        { id: "frost", cost: 3 },
      ],
    })
    const externalId: string = "ember"

    expect(catalog.has("spells", externalId)).toBe(true)
    if (catalog.has("spells", externalId)) {
      expect(catalog.require("spells", externalId).cost).toBe(2)
    }

    const anotherExternalId: string = "frost"
    if (catalog.has("spells", anotherExternalId)) {
      expect(catalog.require("spells", anotherExternalId).cost).toBe(3)
    }
    expect(catalog.has("spells", "missing")).toBe(false)
  })

  it("wide stringはruntimeで検索し、既知の誤literalだけ型で拒否する", () => {
    const catalog = WizContentCatalog.create({
      spells: [
        { id: "ember", damage: 4 },
        { id: "frost", slowRatio: 0.5 },
      ],
    })
    const externalId: string = "ember"
    const found = catalog.get("spells", externalId)
    const required = catalog.require("spells", externalId)

    expectTypeOf(found).toEqualTypeOf<
      | Readonly<{ readonly id: "ember"; readonly damage: 4 }>
      | Readonly<{ readonly id: "frost"; readonly slowRatio: 0.5 }>
      | undefined
    >()
    expectTypeOf(required).toEqualTypeOf<
      | Readonly<{ readonly id: "ember"; readonly damage: 4 }>
      | Readonly<{ readonly id: "frost"; readonly slowRatio: 0.5 }>
    >()
    expect(found).toEqual({ id: "ember", damage: 4 })
    expect(required).toBe(found)
    expect(catalog.get("spells", "missing" as string)).toBeUndefined()
    expect(() => catalog.require("spells", "missing" as string)).toThrow(
      WizContentCatalogEntryNotFoundError
    )

    const verifyKnownInvalidLiteral = () => {
      // @ts-expect-error 既知の誤ID literalはcompile時に拒否する。
      catalog.get("spells", "missing")
      // @ts-expect-error requireも既知の誤ID literalは受け付けない。
      catalog.require("spells", "missing")
    }
    void verifyKnownInvalidLiteral
  })

  it("valid ID unionはexact entry union、category unionはoptional lookupにする", () => {
    const catalog = WizContentCatalog.create({
      spells: [
        { id: "ember", damage: 4 },
        { id: "frost", slowRatio: 0.5 },
      ],
      items: [{ id: "potion", healing: 10 }],
    })
    const findSpell = (id: "ember" | "frost") => catalog.get("spells", id)
    const findAcrossCategories = (category: "spells" | "items") =>
      catalog.get(category, "ember")

    expectTypeOf(findSpell("ember")).toEqualTypeOf<
      | Readonly<{ readonly id: "ember"; readonly damage: 4 }>
      | Readonly<{ readonly id: "frost"; readonly slowRatio: 0.5 }>
    >()
    expectTypeOf(findAcrossCategories("spells")).toEqualTypeOf<
      Readonly<{ readonly id: "ember"; readonly damage: 4 }> | undefined
    >()
    expect(findAcrossCategories("items")).toBeUndefined()
  })

  it("IDごとに異なるentry型まで絞り込む", () => {
    const catalog = WizContentCatalog.create({
      effects: [
        { id: "burn", damage: 4 },
        { id: "slow", ratio: 0.5 },
      ],
    })

    expect(catalog.require("effects", "burn").damage).toBe(4)
    expect(catalog.require("effects", "slow").ratio).toBe(0.5)

    const verifyEntryType = () => {
      // @ts-expect-error burn definitionにratioは存在しない
      return catalog.require("effects", "burn").ratio
    }
    void verifyEntryType
  })

  it("可変長配列のunion IDは存在を仮定せずoptional lookupにする", () => {
    const spells: Array<{
      readonly id: "ember" | "frost"
      readonly cost: number
    }> = [{ id: "ember", cost: 2 }]
    const catalog = WizContentCatalog.create({ spells })

    const missing = catalog.get("spells", "frost")

    expectTypeOf(missing).toEqualTypeOf<
      | Readonly<{
          readonly id: "ember" | "frost"
          readonly cost: number
        }>
      | undefined
    >()
    expect(missing).toBeUndefined()
  })

  it("union entryの固定長tupleでも各slotにないIDを必須扱いしない", () => {
    type Spell =
      | Readonly<{ id: "ember"; damage: 4 }>
      | Readonly<{ id: "frost"; slowRatio: 0.5 }>
      | Readonly<{ id: "storm"; chainCount: 2 }>
    const spells: readonly [Spell, Spell] = [
      { id: "ember", damage: 4 },
      { id: "storm", chainCount: 2 },
    ]
    const catalog = WizContentCatalog.create({ spells })
    const missing = catalog.get("spells", "frost")
    const present = catalog.get("spells", "ember")

    expectTypeOf(missing).toEqualTypeOf<
      Readonly<{ id: "frost"; slowRatio: 0.5 }> | undefined
    >()
    expectTypeOf(present).toEqualTypeOf<
      Readonly<{ id: "ember"; damage: 4 }> | undefined
    >()
    expect(missing).toBeUndefined()
    expect(present).toEqual({ id: "ember", damage: 4 })

    const entriesWithMetadata = Object.assign(spells, {
      metadata: { id: "frost" as const },
    })
    const verifyExtraPropertyDoesNotBecomeTupleIndex = () => {
      const catalogWithMetadata = WizContentCatalog.create({
        spells: entriesWithMetadata,
      })
      const metadataId = catalogWithMetadata.get("spells", "frost")

      expectTypeOf(metadataId).toEqualTypeOf<
        Readonly<{ id: "frost"; slowRatio: 0.5 }> | undefined
      >()
    }
    void verifyExtraPropertyDoesNotBecomeTupleIndex
    expect(() =>
      WizContentCatalog.create({
        spells: entriesWithMetadata,
      })
    ).toThrow(WizContentCatalogValidationError)
  })

  it("Zod schemaでunknownを検証してからliteral型を保持する", () => {
    const schema = z.strictObject({
      spells: z.array(
        z.strictObject({
          id: z.enum(["ember", "frost"]),
          cost: z.number().int().nonnegative(),
        })
      ),
    })
    const catalog = WizContentCatalog.parse(
      {
        spells: [{ id: "ember", cost: 2 }],
      },
      { schema }
    )

    expect(catalog.require("spells", "ember").cost).toBe(2)
    expect(() =>
      WizContentCatalog.parse(
        {
          spells: [{ id: "ember", cost: -1 }],
        },
        { schema }
      )
    ).toThrow(WizStandardSchemaValidationError)

    const verifySchemaIdType = () => {
      // @ts-expect-error schemaに存在しないIDは許可しない
      catalog.require("spells", "spark")
    }
    void verifySchemaIdType
  })

  it("手書きStandard Schemaの変換outputを型保持してimmutable ownershipへ渡す", () => {
    type RawCatalog = Readonly<{
      spells: readonly Readonly<{
        id: "ember"
        cost: string
      }>[]
    }>
    type ParsedCatalog = {
      spells: {
        id: "ember"
        cost: number
        tags: string[]
      }[]
    }
    const schemaOutput: ParsedCatalog = {
      spells: [{ id: "ember", cost: 4, tags: ["fire"] }],
    }
    const schema: WizStandardSchemaDefinition<RawCatalog, ParsedCatalog> = {
      "~standard": {
        validate: (input: unknown) => {
          if (
            typeof input !== "object" ||
            input === null ||
            !("spells" in input)
          ) {
            return {
              issues: [{ message: "spells must be present", path: ["spells"] }],
            }
          }

          return { value: schemaOutput }
        },
        vendor: "catalog-test",
        version: 1,
      },
    }
    const catalog = WizContentCatalog.parse(
      {
        spells: [{ id: "ember", cost: "4" }],
      },
      { schema }
    )
    const spell = catalog.require("spells", "ember")
    const spellId: "ember" = spell.id
    const spellCost: number = spell.cost

    schemaOutput.spells[0].cost = 99
    schemaOutput.spells[0].tags.push("mutated")

    expectTypeOf(spellId).toEqualTypeOf<"ember">()
    expectTypeOf(spellCost).toEqualTypeOf<number>()
    expect(spell).toEqual({
      id: "ember",
      cost: 4,
      tags: ["fire"],
    })
    expect(Object.isFrozen(catalog.categories.spells[0])).toBe(true)
    expect(Object.isFrozen(catalog.categories.spells[0].tags)).toBe(true)
  })

  it("空IDと重複IDをpath付きで集約する", () => {
    expect(() =>
      WizContentCatalog.create({
        spells: [
          { id: "", cost: 1 },
          { id: "ember", cost: 2 },
          { id: "ember", cost: 3 },
        ],
        "quest rewards": [
          { id: "   ", amount: 1 },
          { id: "gold", amount: 2 },
          { id: "gold", amount: 3 },
        ],
      })
    ).toThrow(WizContentCatalogValidationError)

    try {
      WizContentCatalog.create({
        spells: [{ id: "" }, { id: "ember" }, { id: "ember" }],
        "quest rewards": [{ id: "   " }, { id: "gold" }, { id: "gold" }],
      })
    } catch (error) {
      expect(error).toBeInstanceOf(WizContentCatalogValidationError)
      if (!(error instanceof WizContentCatalogValidationError)) {
        return
      }
      expect(error.diagnostics).toEqual([
        expect.objectContaining({
          code: "empty_id",
          path: "$.spells[0].id",
        }),
        expect.objectContaining({
          code: "duplicate_id",
          path: "$.spells[2].id",
          firstPath: "$.spells[1].id",
        }),
        expect.objectContaining({
          code: "empty_id",
          path: '$["quest rewards"][0].id',
        }),
        expect.objectContaining({
          code: "duplicate_id",
          path: '$["quest rewards"][2].id',
          firstPath: '$["quest rewards"][1].id',
        }),
      ])
      expect(Object.isFrozen(error)).toBe(true)
      expect(Object.isFrozen(error.diagnostics)).toBe(true)
      expect(error.diagnostics.every(Object.isFrozen)).toBe(true)
    }
  })

  it("category・ID・referenceの前後空白を別identityとして受理しない", () => {
    expect(() =>
      WizContentCatalog.create({
        " spells": [{ id: "ember" }],
        items: [{ id: " potion " }],
      })
    ).toThrow(WizContentCatalogValidationError)

    try {
      WizContentCatalog.create({
        " spells": [{ id: "ember" }],
        items: [{ id: " potion " }],
      })
    } catch (error) {
      expect(error).toBeInstanceOf(WizContentCatalogValidationError)
      if (!(error instanceof WizContentCatalogValidationError)) {
        return
      }
      expect(error.diagnostics).toEqual([
        expect.objectContaining({
          code: "non_canonical_category",
          category: " spells",
          path: '$[" spells"]',
        }),
        expect.objectContaining({
          code: "non_canonical_id",
          category: "items",
          id: " potion ",
          path: "$.items[0].id",
        }),
      ])
    }

    const catalog = WizContentCatalog.create({
      items: [{ id: "potion" }],
      quests: [{ id: "first_quest", rewardItemId: " potion " }],
    })
    const diagnostics = catalog.diagnoseReferences((references) => [
      references.define({
        source: "quests",
        target: "items",
        select: (quest) => quest.rewardItemId as "potion",
        path: " rewardItemId ",
      }),
      references.define({
        source: "quests",
        target: "items",
        select: (quest) => quest.rewardItemId as "potion",
        path: "rewardItemId",
      }),
    ])

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "invalid_reference_rule",
        path: "$references[0]",
      }),
      expect.objectContaining({
        code: "invalid_reference",
        path: "$.quests[0].rewardItemId",
      }),
    ])
  })

  it("symbol・非列挙categoryを隠れたcontentとして保持しない", () => {
    const hiddenCategory = Symbol("hidden")
    const categories = {
      items: [{ id: "potion" }],
      [hiddenCategory]: () => "secret",
    }
    Object.defineProperty(categories, "quests", {
      configurable: true,
      enumerable: false,
      value: [{ id: "hidden_quest" }],
      writable: true,
    })

    expect(() => WizContentCatalog.create(categories)).toThrow(
      WizContentCatalogValidationError
    )

    try {
      WizContentCatalog.create(categories)
    } catch (error) {
      expect(error).toBeInstanceOf(WizContentCatalogValidationError)
      if (!(error instanceof WizContentCatalogValidationError)) {
        return
      }
      expect(error.diagnostics).toEqual([
        expect.objectContaining({
          code: "invalid_category_property",
          property: "quests",
          path: "$.quests",
        }),
        expect.objectContaining({
          code: "invalid_category_property",
          property: "Symbol(hidden)",
          path: "$",
        }),
      ])
    }
  })

  it("entry index・ID accessorを実行せずcatalog diagnosticにする", () => {
    let accessCount = 0
    const accessorEntry = {}
    Object.defineProperty(accessorEntry, "id", {
      enumerable: true,
      get: () => {
        accessCount += 1
        return "secret"
      },
    })
    const entries = [accessorEntry]
    Object.defineProperty(entries, "0", {
      enumerable: true,
      get: () => {
        accessCount += 1
        return accessorEntry
      },
    })

    expect(() =>
      WizContentCatalog.create({
        items: entries as unknown as readonly Readonly<{ id: string }>[],
      })
    ).toThrow(WizContentCatalogValidationError)
    expect(accessCount).toBe(0)
  })

  it("型を迂回したmissing category/IDも専用errorで診断する", () => {
    const catalog = WizContentCatalog.create({
      spells: [{ id: "ember" }],
    })

    expect(() => catalog.list("missing" as "spells")).toThrow(
      WizContentCatalogCategoryNotFoundError
    )
    expect(() => catalog.require("spells", "missing" as "ember")).toThrow(
      WizContentCatalogEntryNotFoundError
    )

    try {
      catalog.require("spells", "missing" as "ember")
    } catch (error) {
      expect(error).toMatchObject({
        category: "spells",
        id: "missing",
        path: '$.spells[id="missing"]',
      })
    }
  })

  it("deep immutable class entryはprototypeを保つ", () => {
    class SpellDefinition<TId extends string> {
      declare readonly [WIZ_IMMUTABLE_VALUE]: true
      #power: number
      readonly metadata: Readonly<{ power: number }>

      constructor(
        readonly id: TId,
        power: number
      ) {
        this.#power = power
        this.metadata = Object.freeze({ power })
        WizImmutableValue.freeze(this)
      }

      damage(): number {
        return this.#power
      }

      convert(value: string): string
      convert(value: number): number
      convert(value: string | number): string | number {
        return value
      }

      identity<TValue>(value: TValue): TValue {
        return value
      }
    }

    const spell = new SpellDefinition<"ember">("ember", 4)
    const catalog = WizContentCatalog.create({ spells: [spell] })
    const restored = catalog.require("spells", "ember")

    expectTypeOf(restored).toEqualTypeOf<SpellDefinition<"ember">>()
    expect(restored).toBe(spell)
    expect(restored).toBeInstanceOf(SpellDefinition)
    expect(restored.damage()).toBe(4)
    expect(restored.convert("4")).toBe("4")
    expect(restored.convert(4)).toBe(4)
    expect(restored.identity({ power: 4 })).toEqual({ power: 4 })
  })

  it("category間の単一・optional・nested参照をliteral IDで検証する", () => {
    const catalog = WizContentCatalog.create({
      items: [{ id: "potion" }, { id: "ether" }],
      monsters: [{ id: "slime" }],
      quests: [
        {
          id: "herb_hunt",
          rewardItemId: "potion",
          bonusItemIds: ["ether"],
          optionalItemId: undefined,
          monsterId: "slime",
        },
      ],
      areas: [{ id: "meadow", monsterIds: ["slime"] }],
    })

    expect(
      catalog.validateReferences((references) => {
        const rules = [
          references.define({
            source: "quests",
            target: "items",
            select: (quest) => [
              quest.rewardItemId,
              quest.bonusItemIds,
              quest.optionalItemId,
            ],
            path: "rewards",
          }),
          references.define({
            source: "areas",
            target: "monsters",
            select: (area) => area.monsterIds,
            path: "monsterIds",
          }),
        ]

        expect(rules.every(Object.isFrozen)).toBe(true)
        return rules
      })
    ).toBe(catalog)
    expect(
      catalog.diagnoseReferences((references) => [
        references.define({
          source: "quests",
          target: "items",
          select: (quest) => quest.rewardItemId,
          path: "rewardItemId",
        }),
      ])
    ).toEqual([])

    const verifyReferenceTypes = () => {
      catalog.validateReferences((references) => [
        references.define({
          source: "quests",
          target: "items",
          // @ts-expect-error selectorはtarget categoryのliteral IDだけを返す
          select: (quest) => quest.monsterId,
          path: "monsterId",
        }),
        references.define({
          source: "areas",
          // @ts-expect-error catalogに存在しないtarget categoryは指定できない
          target: "spells",
          select: (area) => area.monsterIds,
          path: "monsterIds",
        }),
      ])
    }
    void verifyReferenceTypes
  })

  it("missing・wrong-category・invalid参照をnested path付きで集約する", () => {
    const catalog = WizContentCatalog.create({
      items: [{ id: "potion" }],
      monsters: [{ id: "slime" }],
      quests: [
        {
          id: "broken_quest",
          missingItemId: "missing",
          monsterId: "slime",
          malformedReferences: [[""], [42]],
        },
      ],
    })

    const configureInvalidReferences = (
      references: Parameters<typeof catalog.diagnoseReferences>[0] extends (
        references: infer TReferences
      ) => unknown
        ? TReferences
        : never
    ) => [
      references.define({
        source: "quests",
        target: "items",
        select: (quest) => quest.missingItemId as "potion",
        path: "missingItemId",
      }),
      references.define({
        source: "quests",
        target: "items",
        select: (quest) => quest.monsterId as "potion",
        path: "monsterId",
      }),
      references.define({
        source: "quests",
        target: "items",
        select: (quest) =>
          quest.malformedReferences as unknown as readonly (readonly "potion"[])[],
        path: "malformedReferences",
      }),
    ]
    const diagnostics = catalog.diagnoseReferences(configureInvalidReferences)

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "missing_reference",
        id: "missing",
        path: "$.quests[0].missingItemId",
      }),
      expect.objectContaining({
        code: "wrong_category_reference",
        id: "slime",
        actualCategories: ["monsters"],
        path: "$.quests[0].monsterId",
      }),
      expect.objectContaining({
        code: "invalid_reference",
        path: "$.quests[0].malformedReferences[0][0]",
      }),
      expect.objectContaining({
        code: "invalid_reference",
        path: "$.quests[0].malformedReferences[1][0]",
      }),
    ])
    expect(Object.isFrozen(diagnostics)).toBe(true)
    expect(diagnostics.every(Object.isFrozen)).toBe(true)
    const wrongCategory = diagnostics.find(
      (diagnostic) => diagnostic.code === "wrong_category_reference"
    )
    expect(wrongCategory).toBeDefined()
    if (wrongCategory?.code !== "wrong_category_reference") {
      throw new TypeError("Expected a wrong-category diagnostic")
    }
    expect(wrongCategory.actualCategories).toEqual(["monsters"])
    expect(Object.isFrozen(wrongCategory.actualCategories)).toBe(true)

    expect(() =>
      catalog.validateReferences(configureInvalidReferences)
    ).toThrow(WizContentCatalogReferenceValidationError)
    try {
      catalog.validateReferences(configureInvalidReferences)
    } catch (error) {
      expect(error).toBeInstanceOf(WizContentCatalogReferenceValidationError)
      if (!(error instanceof WizContentCatalogReferenceValidationError)) {
        return
      }
      expect(Object.isFrozen(error)).toBe(true)
      expect(Object.isFrozen(error.diagnostics)).toBe(true)
      expect(error.diagnostics.every(Object.isFrozen)).toBe(true)
    }
  })

  it("型迂回によるmissing categoryとselector例外もdiagnosticにする", () => {
    const catalog = WizContentCatalog.create({
      items: [{ id: "potion" }],
      quests: [{ id: "herb_hunt", rewardItemId: "potion" }],
    })

    const diagnostics = catalog.diagnoseReferences((references) => [
      references.define({
        source: "quests",
        target: "missing" as "items",
        select: (quest) => quest.rewardItemId,
        path: "rewardItemId",
      }),
      references.define({
        source: "quests",
        target: "items",
        select: (): "potion" => {
          throw new Error("selector failure")
        },
        path: "rewardItemId",
      }),
    ])

    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "missing_category",
        role: "target",
        category: "missing",
        path: "$references[0].target",
      }),
      expect.objectContaining({
        code: "invalid_reference",
        sourceId: "herb_hunt",
        path: "$.quests[0].rewardItemId",
        message: expect.stringContaining("selector failure"),
      }),
    ])
  })
})
