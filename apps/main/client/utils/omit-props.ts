type RemainingProps<P, K extends PropertyKey> = P extends object
  ? Omit<P, K>
  : never

/** rest propsの判別可能なunion型と、列挙可能な独自プロパティを保つ。 */
export function omitProps<P extends object, K extends keyof P>(
  props: P,
  keys: readonly K[]
): RemainingProps<P, K>
export function omitProps(props: object, keys: readonly PropertyKey[]) {
  const omitted = new Set(
    keys.map((key) => (typeof key === "symbol" ? key : String(key)))
  )
  const remaining = {}
  for (const key of Reflect.ownKeys(props)) {
    if (
      omitted.has(key) ||
      !Object.getOwnPropertyDescriptor(props, key)?.enumerable
    )
      continue
    Object.defineProperty(remaining, key, {
      value: Reflect.get(props, key),
      enumerable: true,
      configurable: true,
      writable: true,
    })
  }
  return remaining
}
