export const isPlainArrayValue = (value: object): value is unknown[] =>
  Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype
