import type { NumericConstraints } from "@/lib/wiz/core/value-validation"

export const numericExpectation = (constraints: NumericConstraints): string => {
  const descriptions = ["a finite number"]
  if (constraints.safeInteger) {
    descriptions.push("a safe integer")
  } else if (constraints.integer) {
    descriptions.push("an integer")
  }
  if (constraints.minimum !== undefined) {
    descriptions.push(`at least ${constraints.minimum}`)
  }
  if (constraints.maximum !== undefined) {
    descriptions.push(`at most ${constraints.maximum}`)
  }
  return descriptions.join(", ")
}
