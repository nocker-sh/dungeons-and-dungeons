import type { WizValueValidationSource } from "@/lib/wiz/core/value-validation"
import { assertFiniteNumberValue } from "@/lib/wiz/core/assert-finite-number-value"
import { childPath } from "@/lib/wiz/core/child-path"

/**
 * custom status内の数値だけを再帰的に検証する。
 * 数値以外のcustom metadataのshapeや符号には制約を加えない。
 */
export function assertFiniteNumericFields(
  source: WizValueValidationSource,
  path: string,
  value: unknown,
  visited: WeakSet<object> = new WeakSet()
): void {
  if (typeof value === "number") {
    assertFiniteNumberValue(source, path, value)
    return
  }
  if (typeof value !== "object" || value === null || visited.has(value)) {
    return
  }

  visited.add(value)
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === "length") {
      continue
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (!descriptor || !("value" in descriptor)) {
      continue
    }
    assertFiniteNumericFields(
      source,
      childPath(path, key),
      descriptor.value,
      visited
    )
  }
}
