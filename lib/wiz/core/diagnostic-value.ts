import { describeWizValueType } from "@/lib/wiz/core/value-type"

const wizDiagnosticAccessor = Object.freeze({ valueType: "Accessor" })

const summarizeWizDiagnosticValue = (value: unknown): Readonly<{ valueType: string }> =>
  Object.freeze({ valueType: describeWizValueType(value) })

const readWizDiagnosticDescriptors = (
  value: object,
): readonly (readonly [PropertyKey, PropertyDescriptor])[] | null => {
  try {
    const entries = Reflect.ownKeys(value).flatMap((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      return descriptor ? ([[key, descriptor]] as const) : []
    })
    return Object.freeze(entries)
  } catch {
    return null
  }
}

/**
 * 外部参照を保持しない、deep immutableなdiagnostic snapshotを作る。
 *
 * class/functionは実体を保持せず型名だけに縮約し、error reportingが利用側の
 * mutable objectやclosureを所有しないようにする。
 */
export const ownWizDiagnosticValue = (
  value: unknown,
  copies: WeakMap<object, object> = new WeakMap(),
): unknown => {
  if (typeof value === "function") {
    return summarizeWizDiagnosticValue(value)
  }
  if (value === null || typeof value !== "object") {
    return value
  }

  const existing = copies.get(value)
  if (existing) {
    return existing
  }

  let arrayValue = false
  try {
    arrayValue = Array.isArray(value)
  } catch {
    return summarizeWizDiagnosticValue(value)
  }

  const descriptors = readWizDiagnosticDescriptors(value)
  if (descriptors === null) {
    return summarizeWizDiagnosticValue(value)
  }

  if (arrayValue) {
    const copy: unknown[] = []
    copies.set(value, copy)
    const lengthDescriptor = descriptors.find(([key]) => key === "length")?.[1]
    if (
      lengthDescriptor &&
      "value" in lengthDescriptor &&
      typeof lengthDescriptor.value === "number"
    ) {
      copy.length = lengthDescriptor.value
    }
    for (const [key, descriptor] of descriptors) {
      if (key === "length") {
        continue
      }
      Object.defineProperty(copy, key, {
        configurable: false,
        enumerable: descriptor.enumerable ?? false,
        value:
          "value" in descriptor
            ? ownWizDiagnosticValue(descriptor.value, copies)
            : wizDiagnosticAccessor,
        writable: false,
      })
    }
    return Object.freeze(copy)
  }

  let prototype: object | null
  try {
    prototype = Object.getPrototypeOf(value)
  } catch {
    return summarizeWizDiagnosticValue(value)
  }
  if (prototype !== Object.prototype && prototype !== null) {
    return summarizeWizDiagnosticValue(value)
  }

  const copy = Object.create(prototype) as Record<PropertyKey, unknown>
  copies.set(value, copy)
  for (const [key, descriptor] of descriptors) {
    Object.defineProperty(copy, key, {
      configurable: false,
      enumerable: descriptor.enumerable,
      value:
        "value" in descriptor
          ? ownWizDiagnosticValue(descriptor.value, copies)
          : wizDiagnosticAccessor,
      writable: false,
    })
  }
  return Object.freeze(copy)
}
