import { describe, expect, it } from "vite-plus/test"
import {
  WizEngineBattleContent,
  WizEngineBattleContentError,
} from "@/lib/wiz/core/engine/battle/content"
import { WizAbility } from "@/lib/wiz/core/domain/values/ability"
import { WizItem } from "@/lib/wiz/core/domain/values/item"
import { isBattleUsableItem } from "@/lib/wiz/core/engine/battle/is-battle-usable-item"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { wizMockPotion } from "@/lib/wiz/core/mocks/wiz-mock-potion"
import { wizMockFireballAbility } from "@/lib/wiz/core/mocks/wiz-mock-fireball-ability"
import type { WizItemEffectDefinition } from "@/lib/wiz/core/types/item-effect"

class BattleContentMetadata {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly #rank: number

  constructor(rank: number) {
    this.#rank = rank
    WizImmutableValue.freeze(this)
  }

  getRank(): number {
    return this.#rank
  }
}

const createItemWithCustom = <TCustom>(custom: TCustom) => {
  const item = WizItem.define<string, WizItemEffectDefinition, TCustom>({
    id: "custom-potion",
    name: "Custom Potion",
    effect: { type: "heal", value: 10 },
    custom,
  })
  if (!isBattleUsableItem(item))
    throw new TypeError("Expected a battle-usable item")
  return item
}

describe("WizEngineBattleContent", () => {
  it("resolverをbindせず呼べ、実装を差し替えられない", () => {
    const skill = wizMockFireballAbility()
    const item = wizMockPotion()
    const content = WizEngineBattleContent.fromArrays({
      abilities: [skill],
      items: [item],
    })
    const { resolveAbility, resolveItem } = content

    expect(resolveAbility(skill.id)?.id).toBe(skill.id)
    expect(resolveItem(item.id)?.id).toBe(item.id)
    expect(Object.isFrozen(content)).toBe(true)
    expect(Object.isFrozen(WizEngineBattleContent.prototype)).toBe(true)
    expect(Object.isFrozen(WizEngineBattleContent)).toBe(true)

    const verifyReadonly = () => {
      const replacementResolveSkill = content.resolveAbility
      const replacementResolveItem = content.resolveItem
      // @ts-expect-error resolveAbilityはreadonly function property。
      content.resolveAbility = replacementResolveSkill
      // @ts-expect-error resolveItemはreadonly function property。
      content.resolveItem = replacementResolveItem
    }
    void verifyReadonly
  })

  it("canonical skill/itemをIDで解決する", () => {
    const skill = wizMockFireballAbility()
    const item = wizMockPotion()
    const content = new WizEngineBattleContent({
      abilities: { [skill.id]: skill },
      items: { [item.id]: item },
    })

    expect(content.resolveAbility(skill.id)?.toProperties()).toEqual(
      skill.toProperties()
    )
    expect(content.resolveItem(item.id)?.toProperties()).toEqual(
      item.toProperties()
    )
    expect(content.resolveAbility("missing")).toBeUndefined()
    expect(content.resolveItem("missing")).toBeUndefined()
  })

  it("入力recordとcustomを防御的に複製して凍結する", () => {
    const skill = wizMockFireballAbility().withCustom({ nested: { value: 1 } })
    const abilities: Record<string, typeof skill> = { [skill.id]: skill }
    const content = new WizEngineBattleContent({ abilities })

    delete abilities[skill.id]

    const resolved = content.resolveAbility(skill.id)
    expect(resolved).toBeDefined()
    if (!resolved) throw new Error("Expected canonical skill")
    expect(Object.isFrozen(content)).toBe(true)
    expect(Object.isFrozen(content.abilities)).toBe(true)
    expect(Object.isFrozen(resolved.custom)).toBe(true)
    expect(
      Object.isFrozen((resolved.custom as { nested: object }).nested)
    ).toBe(true)
  })

  it("caller-ownedのplain customを所有分離する", () => {
    const custom = { nested: { value: 1 } }
    const item = createItemWithCustom(custom)
    const items: Record<string, typeof item> = { [item.id]: item }
    const content = new WizEngineBattleContent({ items })

    custom.nested.value = 99
    delete items[item.id]

    expect(content.resolveItem(item.id)?.custom).toEqual({
      nested: { value: 1 },
    })
  })

  it("immutable custom classのprototypeとprivate stateを保持する", () => {
    const metadata = new BattleContentMetadata(7)
    const item = createItemWithCustom({ metadata })
    const content = new WizEngineBattleContent({
      items: { [item.id]: item },
    })

    const resolvedMetadata = (
      content.resolveItem(item.id)?.custom as
        | Readonly<{ metadata: BattleContentMetadata }>
        | undefined
    )?.metadata

    expect(resolvedMetadata).toBe(metadata)
    expect(resolvedMetadata).toBeInstanceOf(BattleContentMetadata)
    if (!(resolvedMetadata instanceof BattleContentMetadata)) {
      throw new TypeError("Expected immutable battle content metadata")
    }
    expect(resolvedMetadata.getRank()).toBe(7)
  })

  it("definition recordをnull-prototypeにし、own propertyだけを解決する", () => {
    const content = new WizEngineBattleContent()

    expect(Object.getPrototypeOf(content.abilities)).toBeNull()
    expect(Object.getPrototypeOf(content.items)).toBeNull()
    expect(Object.isFrozen(content.abilities)).toBe(true)
    expect(Object.isFrozen(content.items)).toBe(true)
    expect(content.resolveAbility("toString")).toBeUndefined()
    expect(content.resolveItem("constructor")).toBeUndefined()
  })

  it("fromArraysは重複ability IDを拒否する", () => {
    const skill = wizMockFireballAbility()

    expect(() =>
      WizEngineBattleContent.fromArrays({ abilities: [skill, skill] })
    ).toThrow(WizEngineBattleContentError)
  })

  it("fromArraysは重複item IDを拒否する", () => {
    const item = wizMockPotion()

    expect(() =>
      WizEngineBattleContent.fromArrays({ items: [item, item] })
    ).toThrow(WizEngineBattleContentError)
  })

  it("record keyとdefinition IDの不整合を拒否する", () => {
    const skill = wizMockFireballAbility()

    expect(
      () =>
        new WizEngineBattleContent({
          abilities: { mismatched: skill },
        })
    ).toThrow(WizEngineBattleContentError)
  })

  it("battle外の正規Ability instanceを型偽装されても拒否する", () => {
    const movementAbility = WizAbility.define({
      id: "dash",
      name: "Dash",
      costs: { stamina: 5 },
      effect: { type: "movement", distance: 3 },
    })

    expect(() =>
      WizEngineBattleContent.fromArrays({
        abilities: [movementAbility as never],
      })
    ).toThrow(
      expect.objectContaining({
        code: "invalid_definition",
        kind: "ability",
      })
    )
  })

  it("battle外の正規Item instanceを型偽装されても拒否する", () => {
    const torch = WizItem.define({
      id: "torch",
      name: "Torch",
      effect: { type: "torch" },
    })

    expect(() =>
      WizEngineBattleContent.fromArrays({
        items: [torch as never],
      })
    ).toThrow(
      expect.objectContaining({
        code: "invalid_definition",
        kind: "item",
      })
    )
  })

  it("canonical classでも不正なbattle effect値を再検証する", () => {
    const invalidPotion = WizItem.define({
      id: "invalid-potion",
      name: "Invalid Potion",
      effect: { type: "heal", value: Number.NaN },
    })

    expect(() =>
      WizEngineBattleContent.fromArrays({
        items: [invalidPotion as never],
      })
    ).toThrow(
      expect.objectContaining({
        code: "invalid_definition",
        kind: "item",
      })
    )
  })
})
