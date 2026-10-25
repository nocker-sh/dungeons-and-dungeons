import { describeWizValueType } from "@/lib/wiz/core/value-type"

function ownConfigValue<T>(value: T, copies: WeakMap<object, object>): T {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) {
    return value
  }

  if (typeof value === "function") {
    return value
  }

  const cached = copies.get(value)
  if (cached) {
    return cached as T
  }

  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      const typeName = describeWizValueType(value)
      throw new TypeError(`Immutable config only supports plain arrays: ${typeName}`)
    }
    const owned: unknown[] = []
    owned.length = value.length
    copies.set(value, owned)

    for (const key of Reflect.ownKeys(value)) {
      if (key === "length") {
        continue
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor) {
        continue
      }
      if (!("value" in descriptor)) {
        throw new TypeError("Immutable config does not support accessor properties")
      }

      Object.defineProperty(owned, key, {
        ...descriptor,
        value: ownConfigValue(descriptor.value, copies),
      })
    }

    return Object.freeze(owned) as T
  }

  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) {
    const typeName = describeWizValueType(value)
    throw new TypeError(
      `Immutable config only supports plain objects, arrays, and functions: ${typeName}`,
    )
  }

  const owned = Object.create(prototype) as Record<PropertyKey, unknown>
  copies.set(value, owned)

  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor) {
      continue
    }
    if (!("value" in descriptor)) {
      throw new TypeError("Immutable config does not support accessor properties")
    }

    Object.defineProperty(owned, key, {
      ...descriptor,
      value: ownConfigValue(descriptor.value, copies),
    })
  }

  return Object.freeze(owned) as T
}

/**
 * 設定値を呼び出し側から所有分離し、ネストまで不変にする。
 *
 * 計算規則として注入された関数は同一参照を保持する。
 */
export function immutableConfig<const T>(value: T): T {
  return ownConfigValue(value, new WeakMap<object, object>())
}
