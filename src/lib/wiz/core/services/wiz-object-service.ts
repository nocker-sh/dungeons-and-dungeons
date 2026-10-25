import {
  isMutableBuiltInValue,
  isPlainArrayValue,
  type WizDeepReadonly,
  type WizImmutableValueContract,
  WizImmutableValue,
} from "@/lib/wiz/core/immutable-value"
import { describeWizValueType } from "@/lib/wiz/core/value-type"

export class WizObjectService {
  private readonly ownedValues = new WeakSet<object>()

  constructor() {
    Object.freeze(this)
  }

  /**
   * plain object / array を再帰的に複製して、この境界が所有する不変値へ変換する。
   *
   * `WizImmutableValue` contractを宣言したdeep freeze済みclassだけを共有し、
   * prototypeを維持する。宣言のないclass、外側だけfreezeされたclass、
   * mutable class、mutable built-inは安全に複製できないため拒否する。
   */
  ownImmutable<T extends WizImmutableValueContract>(value: T): T
  ownImmutable<T>(value: T): WizDeepReadonly<T>
  ownImmutable<T>(value: T | WizDeepReadonly<T>): WizDeepReadonly<T>
  ownImmutable(value: unknown): unknown {
    return this.ownValue(value, new WeakMap<object, object>())
  }

  private ownValue(value: unknown, copies: WeakMap<object, object>): unknown {
    if (typeof value === "function") {
      throw new TypeError("Cannot own function as immutable data")
    }
    if (value === null || typeof value !== "object") {
      return value
    }
    if (this.ownedValues.has(value)) {
      return value
    }

    const existing = copies.get(value)
    if (existing) {
      return existing
    }

    if (isPlainArrayValue(value)) {
      const copy: unknown[] = []
      copy.length = value.length
      copies.set(value, copy)
      this.copyDataProperties(value, copy, copies, "length")
      const owned = Object.freeze(copy)
      this.ownedValues.add(owned)
      return owned
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      if (this.isMutableBuiltin(value)) {
        const valueType = describeWizValueType(value)
        throw new TypeError(`Cannot own mutable built-in instance: ${valueType}`)
      }
      if (Object.isFrozen(value)) {
        if (!WizImmutableValue.is(value)) {
          const valueType = describeWizValueType(value)
          throw new TypeError(`Cannot own class without immutable value contract: ${valueType}`)
        }
        this.assertDeepImmutableClass(value, new WeakSet())
        this.ownedValues.add(value)
        return value
      }
      const valueType = describeWizValueType(value)
      throw new TypeError(`Cannot own mutable class instance: ${valueType}`)
    }

    const copy = Object.create(prototype) as Record<PropertyKey, unknown>
    copies.set(value, copy)
    this.copyDataProperties(value, copy, copies)
    const owned = Object.freeze(copy)
    this.ownedValues.add(owned)
    return owned
  }

  private assertDeepImmutableClass(value: object, visited: WeakSet<object>): void {
    this.assertDeepImmutableValue(value, visited)
  }

  private assertDeepImmutableValue(value: object, visited: WeakSet<object>): void {
    if (visited.has(value)) {
      return
    }
    visited.add(value)

    if (this.isMutableBuiltin(value)) {
      const valueType = describeWizValueType(value)
      throw new TypeError(`Cannot own mutable built-in instance: ${valueType}`)
    }
    if (!isPlainArrayValue(value) && !this.isPlainObject(value) && !WizImmutableValue.is(value)) {
      const valueType = describeWizValueType(value)
      throw new TypeError(`Cannot own class without immutable value contract: ${valueType}`)
    }
    if (!Object.isFrozen(value)) {
      const valueType = describeWizValueType(value)
      throw new TypeError(`Cannot own shallow-frozen nested value: ${valueType}`)
    }
    for (const key of Reflect.ownKeys(value)) {
      if (isPlainArrayValue(value) && key === "length") {
        continue
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor || !("value" in descriptor)) {
        throw new TypeError(`Cannot own accessor property: ${String(key)}`)
      }
      const nested = descriptor.value
      if (typeof nested === "function") {
        throw new TypeError(`Cannot own function property as immutable data: ${String(key)}`)
      } else if (nested !== null && typeof nested === "object") {
        this.assertDeepImmutableValue(nested, visited)
      }
    }
  }

  private isMutableBuiltin(value: object): boolean {
    return isMutableBuiltInValue(value)
  }

  private isPlainObject(value: object): boolean {
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  }

  private copyDataProperties(
    source: object,
    target: object,
    copies: WeakMap<object, object>,
    skippedKey?: PropertyKey,
  ): void {
    for (const key of Reflect.ownKeys(source)) {
      if (key === skippedKey) {
        continue
      }
      const descriptor = Object.getOwnPropertyDescriptor(source, key)
      if (!descriptor) {
        continue
      }
      if (!("value" in descriptor)) {
        throw new TypeError(`Cannot own accessor property: ${String(key)}`)
      }
      Object.defineProperty(target, key, {
        configurable: false,
        enumerable: descriptor.enumerable,
        value: this.ownValue(descriptor.value, copies),
        writable: false,
      })
    }
  }
}
