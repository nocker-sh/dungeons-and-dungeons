/**
 * unknown値のgetterやProxy trapを意図せず実行しないdiagnostic用の型名。
 */
export const describeWizValueType = (value: unknown): string => {
  if (value === null) {
    return "null"
  }
  if (typeof value !== "object" && typeof value !== "function") {
    return typeof value
  }
  try {
    if (Array.isArray(value)) {
      return "Array"
    }
    const prototype = Object.getPrototypeOf(value)
    const descriptor =
      prototype === null ? undefined : Object.getOwnPropertyDescriptor(prototype, "constructor")
    const constructor = descriptor && "value" in descriptor ? descriptor.value : undefined
    if (typeof constructor === "function") {
      const nameDescriptor = Object.getOwnPropertyDescriptor(constructor, "name")
      const name = nameDescriptor && "value" in nameDescriptor ? nameDescriptor.value : undefined
      if (typeof name === "string" && name.length > 0) {
        return name
      }
    }
  } catch {
    // Diagnostic rendering must never replace the original validation failure.
  }

  return typeof value === "function" ? "Function" : "Object"
}
