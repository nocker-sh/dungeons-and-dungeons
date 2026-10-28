import { describe, expect, it } from "vite-plus/test"
import { z } from "zod"
import { zWorldContentArrays } from "@/lib/wiz/core/content/schema"
import { WorldContent } from "@/lib/wiz/core/content/world-content"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"

class ImmutableLore {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly tags: readonly string[]

  constructor(
    readonly id: string,
    tags: readonly string[]
  ) {
    this.tags = Object.freeze([...tags])
    WizImmutableValue.freeze(this)
  }
}

class ShallowLore {
  declare readonly [WIZ_IMMUTABLE_VALUE]: true
  readonly tags: string[]

  constructor(
    readonly id: string,
    tags: string[]
  ) {
    this.tags = tags
    WizImmutableValue.freeze(this)
  }
}

describe("WorldContent custom class ownership", () => {
  it("schemaが検証したdeep immutable classのprototypeを維持する", () => {
    const schema = zWorldContentArrays.extend({
      lore: z.array(z.instanceof(ImmutableLore)),
    })
    const lore = new ImmutableLore("origin", ["history"])

    const content = WorldContent.parse({ lore: [lore] }, { schema })
    const exactLore: ImmutableLore = content.arrays.lore[0]

    const verifyReadonlyContent = () => {
      // @ts-expect-error custom schema categoryはreadonly
      content.arrays.lore.push(lore)
      // @ts-expect-error custom classのreadonly collectionを変更できない
      content.arrays.lore[0].tags.push("mutated")
    }

    void verifyReadonlyContent
    expect(exactLore).toBe(lore)
    expect(content.arrays.lore[0]).toBe(lore)
    expect(content.arrays.lore[0]).toBeInstanceOf(ImmutableLore)
    expect(content.arrays.lore[0]?.tags).toEqual(["history"])
    expect(Object.isFrozen(content.arrays)).toBe(true)
    expect(Object.isFrozen(content.arrays.lore)).toBe(true)
  })

  it("外側だけfreezeされたcustom classを拒否する", () => {
    const schema = zWorldContentArrays.extend({
      lore: z.array(z.instanceof(ShallowLore)),
    })

    expect(() =>
      WorldContent.parse(
        { lore: [new ShallowLore("origin", ["mutable"])] },
        { schema }
      )
    ).toThrow("Cannot own shallow-frozen nested value: Array")
  })

  it("mutable custom classを拒否する", () => {
    class MutableLore {
      constructor(readonly id: string) {}
    }
    const schema = zWorldContentArrays.extend({
      lore: z.array(z.instanceof(MutableLore)),
    })

    expect(() =>
      WorldContent.parse({ lore: [new MutableLore("origin")] }, { schema })
    ).toThrow("Cannot own mutable class instance: MutableLore")
  })

  it("freeze済みでもimmutable value contract未宣言のclassを拒否する", () => {
    class HiddenMutableLore {
      #visits = 0

      constructor(readonly id: string) {
        Object.freeze(this)
      }

      visit(): void {
        this.#visits += 1
      }

      visits(): number {
        return this.#visits
      }
    }
    const schema = zWorldContentArrays.extend({
      lore: z.array(z.instanceof(HiddenMutableLore)),
    })

    expect(() =>
      WorldContent.parse(
        { lore: [new HiddenMutableLore("origin")] },
        { schema }
      )
    ).toThrow(
      "Cannot own class without immutable value contract: HiddenMutableLore"
    )
  })
})
