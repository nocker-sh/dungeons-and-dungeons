export const childPath = (path: string, key: PropertyKey): string => {
  if (typeof key === "symbol") {
    return `${path}[${String(key)}]`
  }
  const stringKey = String(key)
  if (/^(0|[1-9]\d*)$/.test(stringKey)) {
    return `${path}[${stringKey}]`
  }
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(stringKey)
    ? `${path}.${stringKey}`
    : `${path}[${JSON.stringify(stringKey)}]`
}
