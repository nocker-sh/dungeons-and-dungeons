export const describeValue = (value: unknown): string => {
  if (typeof value === "string") {
    return JSON.stringify(value)
  }
  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      return "NaN"
    }
    if (value === Number.POSITIVE_INFINITY) {
      return "Infinity"
    }
    if (value === Number.NEGATIVE_INFINITY) {
      return "-Infinity"
    }
    return value.toString()
  }
  if (value === null) {
    return "null"
  }
  if (typeof value === "object") {
    return Array.isArray(value) ? "array" : "object"
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false"
  }
  if (typeof value === "bigint") {
    return `${value}n`
  }
  if (typeof value === "symbol") {
    return `Symbol(${value.description ?? ""})`
  }
  return typeof value
}
