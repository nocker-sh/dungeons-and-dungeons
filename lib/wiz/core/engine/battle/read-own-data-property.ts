export const readOwnDataProperty = (value: unknown, key: string): unknown => {
  if (typeof value !== "object" || value === null) return undefined
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  return descriptor !== undefined && "value" in descriptor
    ? descriptor.value
    : undefined
}
