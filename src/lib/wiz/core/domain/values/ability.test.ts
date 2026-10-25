import { describe, expect, it } from "vite-plus/test"
import { z } from "zod"
import {
  WizAbility,
  WizAbilityBook,
  WizAbilityCatalog,
  WizAbilityLoadout,
  WizAbilityNotReadyError,
  WizAbilityReadiness,
} from "@/lib/wiz/core/domain/values/ability"

const dash = WizAbility.define({
  id: "dash",
  name: "Dash",
  tags: ["movement"],
  costs: { stamina: 15 },
  cooldownMs: 1_000,
  maximumCharges: 2,
  castTimeMs: 0,
  recoveryTimeMs: 150,
  effect: {
    distance: 4,
    kind: "move",
  } as const,
})

const heal = WizAbility.define({
  id: "heal",
  name: "Heal",
  costs: { mana: 8 },
  cooldownGroups: { actions: 500 },
  cooldownMs: 2_000,
  effect: {
    kind: "restore",
    power: 20,
  } as const,
})

describe("WizAbility", () => {
  it("型付きeffectとtimingを持つ不変定義を作る", () => {
    const source = {
      tags: ["attack"],
      costs: { stamina: 10 },
      effect: { kind: "strike", power: 5 },
      custom: { animation: { clip: "slash" } },
    }
    const ability = WizAbility.define({
      id: "slash",
      name: "Slash",
      tags: source.tags,
      costs: source.costs,
      cooldownMs: 300,
      castTimeMs: 50,
      recoveryTimeMs: 200,
      effect: source.effect,
      custom: source.custom,
    })

    source.tags.push("forged")
    source.costs.stamina = 999
    source.effect.power = 999
    source.custom.animation.clip = "forged"

    expect(ability.tags).toEqual(["attack"])
    expect(ability.costs).toEqual({ stamina: 10 })
    expect(ability.effect).toEqual({ kind: "strike", power: 5 })
    expect(ability.custom).toEqual({ animation: { clip: "slash" } })
    expect(Object.isFrozen(ability)).toBe(true)
    expect(Object.isFrozen(ability.effect)).toBe(true)
    expect(Object.isFrozen(ability.custom?.animation)).toBe(true)
  })

  it("Standard Schemaでunknown入力を検証する", () => {
    const schema = z.strictObject({
      id: z.literal("blink"),
      name: z.string(),
      cooldownMs: z.number().int().nonnegative(),
      effect: z.strictObject({
        distance: z.number().positive(),
        kind: z.literal("teleport"),
      }),
    })

    const ability = WizAbility.fromUnknown(
      {
        id: "blink",
        name: "Blink",
        cooldownMs: 500,
        effect: { distance: 8, kind: "teleport" },
      },
      schema,
    )

    expect(ability.id).toBe("blink")
    expect(ability.effect.kind).toBe("teleport")
    expect(ability.effect.distance).toBe(8)
  })

  it.each([
    { ...dash.toProperties(), cooldownMs: -1 },
    { ...dash.toProperties(), maximumCharges: 0 },
    { ...dash.toProperties(), tags: ["movement", "movement"] },
    { ...dash.toProperties(), costs: { stamina: Number.NaN } },
  ])("不正な定義を拒否する", (definition) => {
    expect(() => WizAbility.define(definition)).toThrow()
  })
})

describe("WizAbilityCatalog and WizAbilityBook", () => {
  it("literal IDを維持して定義と習得状態を管理する", () => {
    const catalog = WizAbilityCatalog.create([dash, heal])
    const book = catalog.createBook(["dash", "heal"])

    expect(catalog.require("dash").effect.kind).toBe("move")
    expect(book.has("dash")).toBe(true)
    expect(book.forget("dash").has("dash")).toBe(false)
    expect(WizAbilityBook.create(["dash"]).learn("heal").abilityIds).toEqual(["dash", "heal"])
    expect(catalog.restoreBook(["heal"]).abilityIds).toEqual(["heal"])
    expect(() => catalog.restoreBook(["missing"])).toThrow()

    const verifyCatalogId = (): void => {
      // @ts-expect-error catalogに存在しないIDは解決できない。
      catalog.require("missing")
    }
    void verifyCatalogId
  })

  it("重複IDを拒否する", () => {
    expect(() => WizAbilityCatalog.create([dash, dash])).toThrow(RangeError)
    expect(() => WizAbilityBook.create(["dash", "dash"])).toThrow()
  })
})

describe("WizAbilityLoadout", () => {
  it("習得済みAbilityだけを型付きslotへ割り当てる", () => {
    const book = WizAbilityBook.create(["dash", "heal"])
    const loadout = WizAbilityLoadout.create(book, ["primary", "secondary"] as const)
      .assign("primary", "dash")
      .assign("secondary", "heal")

    expect(loadout.abilityAt("primary")).toBe("dash")
    expect(loadout.toPlain()).toEqual({
      primary: "dash",
      secondary: "heal",
    })

    const verifyLoadoutIds = (): void => {
      // @ts-expect-error 宣言していないslotは利用できない。
      loadout.assign("tertiary", "dash")
      // @ts-expect-error 習得候補にないAbilityは利用できない。
      loadout.assign("primary", "missing")
    }
    void verifyLoadoutIds
  })

  it("忘れたAbilityをreconcileでslotから外す", () => {
    const book = WizAbilityBook.create(["dash", "heal"])
    const loadout = WizAbilityLoadout.create(book, ["primary"] as const).assign("primary", "heal")
    const reconciled = loadout.reconcile(book.forget("heal"))

    expect(reconciled.abilityAt("primary")).toBeNull()
  })

  it("復元時に未知のslotと未習得Abilityを拒否する", () => {
    const book = WizAbilityBook.create(["dash"])

    expect(() =>
      WizAbilityLoadout.fromUnknown(book, ["primary"] as const, {
        primary: "missing",
      }),
    ).toThrow()
    expect(() =>
      WizAbilityLoadout.fromUnknown(book, ["primary"] as const, {
        primary: null,
        secondary: null,
      }),
    ).toThrow()
  })

  it("公開factoryを通らないBookを拒否する", () => {
    const forgedBook = Object.create(WizAbilityBook.prototype) as WizAbilityBook<"dash">

    expect(() => WizAbilityLoadout.create(forgedBook, ["primary"] as const)).toThrow(TypeError)
  })
})

describe("WizAbilityReadiness", () => {
  it("frame更新なしでcooldownと複数chargeを管理する", () => {
    const initial = WizAbilityReadiness.create()
    const afterFirstUse = initial.use(dash, 10_000)
    const afterSecondUse = afterFirstUse.use(dash, 10_000)

    expect(initial.availableCharges(dash, 10_000)).toBe(2)
    expect(afterFirstUse.availableCharges(dash, 10_000)).toBe(1)
    expect(afterSecondUse.availableCharges(dash, 10_000)).toBe(0)
    expect(afterSecondUse.readyInMs(dash, 10_000)).toBe(1_000)
    expect(afterSecondUse.availableCharges(dash, 11_000)).toBe(2)
    expect(afterSecondUse.compact(11_000).toPlain()).toEqual({
      abilities: {},
      groups: {},
    })
  })

  it("chargeと共有cooldown groupの両方をready判定へ含める", () => {
    const readiness = WizAbilityReadiness.create().use(heal, 0)

    expect(readiness.isReady(heal, 499)).toBe(false)
    expect(readiness.readyInMs(heal, 499)).toBe(1_501)
    expect(() => readiness.use(heal, 1_000)).toThrow(WizAbilityNotReadyError)
    try {
      readiness.use(heal, 1_000)
    } catch (error) {
      expect(error).toMatchObject({
        abilityId: "heal",
        code: "ABILITY_NOT_READY",
        readyInMs: 1_000,
      })
    }

    const strike = WizAbility.define({
      id: "strike",
      name: "Strike",
      cooldownGroups: { actions: 500 },
      effect: { kind: "damage" } as const,
    })
    expect(readiness.isReady(strike, 499)).toBe(false)
    expect(readiness.isReady(strike, 500)).toBe(true)
  })

  it("保存用plain stateを検証して復元する", () => {
    const catalog = WizAbilityCatalog.create([dash])
    const readiness = WizAbilityReadiness.fromUnknown(catalog, {
      abilities: { dash: [2_000, 1_000] },
      groups: {},
    })

    expect(readiness.toPlain()).toEqual({
      abilities: { dash: [1_000, 2_000] },
      groups: {},
    })
    expect(() =>
      WizAbilityReadiness.fromUnknown(catalog, {
        abilities: { dash: [Number.NaN] },
        groups: {},
      }),
    ).toThrow()
    expect(() =>
      WizAbilityReadiness.fromUnknown(catalog, {
        abilities: { missing: [1_000] },
        groups: {},
      }),
    ).toThrow()
    expect(() =>
      WizAbilityReadiness.fromUnknown(catalog, {
        abilities: { dash: [1_000, 2_000, 3_000] },
        groups: {},
      }),
    ).toThrow()
    expect(() =>
      WizAbilityReadiness.fromUnknown(catalog, {
        abilities: {},
        groups: { missing: 1_000 },
      }),
    ).toThrow()
  })

  it("公開factoryを通らないCatalogを拒否する", () => {
    const forgedCatalog = Object.create(WizAbilityCatalog.prototype) as WizAbilityCatalog<
      typeof dash
    >

    expect(() => WizAbilityReadiness.fromUnknown(forgedCatalog, {})).toThrow(TypeError)
  })
})
