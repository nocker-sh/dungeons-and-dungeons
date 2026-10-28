export const isNativeConstructor = (value: unknown): value is Function =>
  typeof value === "function" &&
  Function.prototype.toString.call(value).includes("[native code]")
