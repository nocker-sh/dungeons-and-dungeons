import { describe, expect, it } from "vite-plus/test"
import {
  WIZ_IMMUTABLE_VALUE,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { MOCK_VAULT } from "@/lib/wiz/core/mocks/mock-vault"
import { WizRpgSceneState } from "@/lib/wiz/core/rpg/scene-state"
import { WizStandardSceneName } from "@/lib/wiz/core/runtime/standard-scene-name"

describe("WizRpgSceneState", () => {
  it("scene name validator自体を生成・差し替えできない", () => {
    expect(() => Reflect.construct(WizStandardSceneName, [])).toThrow(TypeError)
    expect(Object.isFrozen(WizStandardSceneName)).toBe(true)
    expect(Object.isFrozen(WizStandardSceneName.prototype)).toBe(true)
  })

  it("scene dataを所有し、関数型更新で新しいinstanceを返す", () => {
    const source = {
      rests: 0,
      tags: ["safe"],
    }
    const scene = WizRpgSceneState.create("camp", MOCK_VAULT, source)

    source.rests = 99
    source.tags.push("mutated")
    const next = scene.mapData((data) => ({
      ...data,
      rests: data.rests + 1,
    }))
    const verifyReadonlyData = () => {
      // @ts-expect-error scene dataはreadonly
      scene.data.rests = 1
      // @ts-expect-error nested scene dataもreadonly
      scene.data.tags.push("mutated")
    }

    void verifyReadonlyData
    expect(scene.type).toBe("camp")
    expect(scene.data).toEqual({ rests: 0, tags: ["safe"] })
    expect(next.data).toEqual({ rests: 1, tags: ["safe"] })
    expect(next).not.toBe(scene)
    expect(Object.isFrozen(scene)).toBe(true)
    expect(WizImmutableValue.is(scene)).toBe(true)
    expect(Object.isFrozen(scene.data)).toBe(true)
    expect(Object.isFrozen(scene.data.tags)).toBe(true)
  })

  it("vault更新でもscene固有dataを維持する", () => {
    const scene = WizRpgSceneState.create("camp", MOCK_VAULT, { rests: 2 })
    const next = scene.updateVault((vault) =>
      vault.updatePlayer((player) => player.addGold(5))
    )

    expect(next.data).toBe(scene.data)
    expect(next.vault.player.gold).toBe(scene.vault.player.gold + 5)
    expect(scene.vault).toBe(MOCK_VAULT)
  })

  it("immutable class dataのexact typeとprototypeを維持する", () => {
    class CampData {
      declare readonly [WIZ_IMMUTABLE_VALUE]: true

      constructor(readonly rests: number) {
        WizImmutableValue.freeze(this)
      }

      rest(): CampData {
        return new CampData(this.rests + 1)
      }
    }

    const scene = WizRpgSceneState.create("camp", MOCK_VAULT, new CampData(1))
    const exactData: CampData = scene.data

    expect(exactData).toBeInstanceOf(CampData)
    expect(exactData.rest().rests).toBe(2)
  })

  it("空白とbuilt-in予約scene typeを拒否する", () => {
    expect(() => WizRpgSceneState.create(" ", MOCK_VAULT, {})).toThrowError(
      RangeError
    )
    expect(() => WizRpgSceneState.create(" camp", MOCK_VAULT, {})).toThrowError(
      RangeError
    )
    expect(() =>
      WizRpgSceneState.create("village", MOCK_VAULT, {})
    ).toThrowError(/reserved by standard runtime/)
    expect(WizStandardSceneName.isBuiltIn("battle")).toBe(true)
    expect(WizStandardSceneName.isBuiltIn("camp")).toBe(false)
  })

  it("freezeだけでは隠せるprivate可変classをplugin dataとして信頼しない", () => {
    class HiddenCounter {
      #count = 0

      constructor() {
        Object.freeze(this)
      }

      increment(): void {
        this.#count += 1
      }

      get value(): number {
        return this.#count
      }
    }

    const hidden = new HiddenCounter()
    hidden.increment()
    expect(hidden.value).toBe(1)
    expect(() =>
      WizRpgSceneState.create("camp", MOCK_VAULT, {
        hidden,
      })
    ).toThrow(/immutable value contract/)
  })
})
