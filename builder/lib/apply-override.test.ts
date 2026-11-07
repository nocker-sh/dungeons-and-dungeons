import { expect, test } from "vite-plus/test"
import { applyOverride } from "@/builder/lib/apply-override"
import { cloneSource } from "@/builder/lib/clone-source"
import { collection } from "@/builder/lib/collection"

const marker = "__builderOverrideProbe"

test.each([
  `balance.__proto__.${marker}=17`,
  `foes.*.__proto__.${marker}=17`,
  'balance.__proto__={"unexpected":17}',
  '__proto__={"unexpected":17}',
  "balance.constructor=17",
  "balance.toString=17",
  "balance.constructor.prototype.unexpected=17",
])("%s cannot escape the source's own data", (expression) => {
  const source = cloneSource()
  const before = structuredClone(source)
  const sourcePrototype = Object.getPrototypeOf(source)
  const balancePrototype = Object.getPrototypeOf(source.balance)
  const descriptor = Object.getOwnPropertyDescriptor(Object.prototype, marker)
  expect(descriptor).toBeUndefined()
  try {
    expect(() => applyOverride(source, expression)).toThrow()
    expect(source).toEqual(before)
    expect(Object.getPrototypeOf(source)).toBe(sourcePrototype)
    expect(Object.getPrototypeOf(source.balance)).toBe(balancePrototype)
    expect(
      Object.getOwnPropertyDescriptor(Object.prototype, marker)
    ).toBeUndefined()
  } finally {
    // Keep a red regression from leaving its probe in the test process.
    Reflect.deleteProperty(Object.prototype, marker)
  }
})

test("a collection entry needs a field instead of silently writing an undefined key", () => {
  const source = cloneSource()
  const before = structuredClone(source)
  expect(() =>
    applyOverride(source, `foes.${collection(source, "foes")[0].slug}=17`)
  ).toThrow()
  expect(source).toEqual(before)
})

test("ordinary own fields and new optional data fields still accept edits", () => {
  const source = cloneSource()
  const before = structuredClone(source)
  applyOverride(source, "balance.expBase+=2")
  expect((source.balance as Record<string, unknown>).expBase).toBe(
    Number((before.balance as Record<string, unknown>).expBase) + 2
  )
  applyOverride(source, "foes.*.hp*=2")
  for (const [index, foe] of collection(source, "foes").entries())
    expect(foe.hp).toBe(Number(collection(before, "foes")[index].hp) * 2)
  applyOverride(source, `foes.${collection(source, "foes")[0].slug}.resist={}`)
  applyOverride(
    source,
    `foes.${collection(source, "foes")[0].slug}.resist.bind=0.7`
  )
  expect(collection(source, "foes")[0].resist).toEqual({ bind: 0.7 })
  expect(Object.getPrototypeOf(source.balance)).toBe(Object.prototype)
})

test("a wildcard arithmetic error leaves earlier real-data targets unchanged", () => {
  const source = cloneSource()
  const goods = collection(source, "goods")
  const missing = goods.findIndex((entry) => typeof entry.price !== "number")
  expect(missing).toBeGreaterThan(0)
  expect(
    goods.slice(0, missing).every((entry) => typeof entry.price === "number")
  ).toBe(true)
  const before = structuredClone(source)
  expect(() => applyOverride(source, "goods.*.price+=2")).toThrow()
  expect(source).toEqual(before)
})
