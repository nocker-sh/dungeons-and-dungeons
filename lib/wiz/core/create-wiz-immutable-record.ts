/**
 * 文字列keyのown propertyだけを持つ、不変なnull-prototype recordを作る。
 *
 * `Object.prototype`由来の名前をcontent IDとして誤解決しないため、
 * definition lookup用recordはこの境界で正規化する。
 */
export const createWizImmutableRecord = <TValue>(
  entries: Iterable<readonly [string, TValue]>
): Readonly<Record<string, TValue>> => {
  const record = Object.create(null) as Record<string, TValue>
  for (const [key, value] of entries) {
    Object.defineProperty(record, key, {
      configurable: false,
      enumerable: true,
      value,
      writable: false,
    })
  }
  return Object.freeze(record)
}
