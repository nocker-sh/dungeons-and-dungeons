import { expect, it } from "vite-plus/test"
import { omitProps } from "./omit-props"

it("選んだキーを読み取らず除外し、残りのgetter・symbol・独自属性を保つ", () => {
  const symbol = Symbol("property")
  let excludedReads = 0
  let includedReads = 0
  const props = Object.create(
    { inherited: true },
    {
      omitted: {
        enumerable: true,
        get: () => {
          excludedReads++
          return 1
        },
      },
      kept: {
        enumerable: true,
        get: () => {
          includedReads++
          return 2
        },
      },
      hidden: { enumerable: false, value: 3 },
      [symbol]: { enumerable: true, value: 4 },
      ["__proto__"]: { enumerable: true, value: 5 },
    }
  ) as { omitted: number; kept: number; hidden: number; [symbol]: number }
  const result = omitProps(props, ["omitted"])
  expect(excludedReads).toBe(0)
  expect(includedReads).toBe(1)
  expect(Reflect.ownKeys(result)).toEqual(["kept", "__proto__", symbol])
  expect(result.kept).toBe(2)
  expect(result[symbol]).toBe(4)
  expect(Reflect.get(result, "__proto__")).toBe(5)
  expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
})

it("入力のプロパティを削除せず、新しいオブジェクトを返す", () => {
  const props = Object.freeze({ className: "item", value: 2 })
  expect(omitProps(props, ["className"])).toEqual({ value: 2 })
  expect(props).toEqual({ className: "item", value: 2 })
})

it("判別可能なunionの型を保つ", () => {
  type Input =
    | { mode: "text"; text: string; label: string }
    | { mode: "number"; value: number; label: string }
  const check = (props: Input) => {
    const result = omitProps(props, ["label"])
    if (result.mode === "text") expect(result.text).toBe("a")
    else expect(result.value).toBe(2)
  }
  check({ mode: "text", text: "a", label: "A" })
  check({ mode: "number", value: 2, label: "B" })
})
