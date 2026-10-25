/**
 * class instanceがobservableな内部可変状態を持たないことを宣言するprotocol。
 *
 * `Object.freeze()`だけではprivate fieldやclosureの可変性を検査できないため、
 * generic world境界はこの明示的な宣言がないclassを暗黙には信頼しない。
 */
export const WIZ_IMMUTABLE_VALUE = Symbol.for("open-wiz.immutable-value")

export type WizImmutableValueContract = Readonly<{
  [WIZ_IMMUTABLE_VALUE]: true
}>

/** 配列・plain objectの全階層をreadonlyとして表す汎用型。 */
export type WizDeepReadonly<TValue> = TValue extends WizImmutableValueContract
  ? TValue
  : TValue extends (...args: never[]) => unknown
    ? TValue
    : TValue extends readonly unknown[]
      ? { readonly [TKey in keyof TValue]: WizDeepReadonly<TValue[TKey]> }
      : TValue extends object
        ? { readonly [TKey in keyof TValue]: WizDeepReadonly<TValue[TKey]> }
        : TValue

const isNativeConstructor = (value: unknown): value is Function =>
  typeof value === "function" && Function.prototype.toString.call(value).includes("[native code]")

export const isPlainArrayValue = (value: object): value is unknown[] =>
  Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype

/**
 * freezeしても内部slotを変更できる標準型と、そのsubclassを検出する。
 *
 * instance自身のconstructorだけを見ると`class CustomMap extends Map`を見逃すため、
 * prototype chain上の標準constructorまで確認する。plain objectの終端であるObjectと、
 * 呼び出し側で要素をcopyできるArrayは除外する。
 */
export const isMutableBuiltInValue = (value: object): boolean => {
  if (ArrayBuffer.isView(value)) {
    return true
  }

  let prototype = Object.getPrototypeOf(value)
  while (prototype !== null && prototype !== Object.prototype) {
    const constructor = Object.getOwnPropertyDescriptor(prototype, "constructor")?.value
    if (constructor !== Array && constructor !== Object && isNativeConstructor(constructor)) {
      return true
    }
    prototype = Object.getPrototypeOf(prototype)
  }
  return false
}

/**
 * 継承を要求せず、constructorの最後でclass instanceをimmutable valueとして完成させる。
 *
 * nested valueは呼び出し前に不変化すること。world境界でも再帰検証される。
 *
 * @example
 * ```ts
 * class CounterState {
 *   declare readonly [WIZ_IMMUTABLE_VALUE]: true
 *
 *   constructor(readonly count: number) {
 *     WizImmutableValue.freeze(this)
 *   }
 *
 *   increment(): CounterState {
 *     return new CounterState(this.count + 1)
 *   }
 * }
 * ```
 */
export class WizImmutableValue {
  private constructor() {
    throw new TypeError("WizImmutableValue is a static-only utility")
  }

  static freeze<TValue extends object>(value: TValue): TValue & WizImmutableValueContract {
    if (WizImmutableValue.is(value)) {
      return Object.freeze(value) as TValue & WizImmutableValueContract
    }
    if (Object.isFrozen(value)) {
      throw new TypeError("Immutable value must be declared before the class instance is frozen")
    }
    Object.defineProperty(value, WIZ_IMMUTABLE_VALUE, {
      configurable: false,
      enumerable: false,
      value: true,
      writable: false,
    })
    return Object.freeze(value) as TValue & WizImmutableValueContract
  }

  static is(value: unknown): value is object & WizImmutableValueContract {
    if (typeof value !== "object" || value === null) {
      return false
    }
    const declaration = Object.getOwnPropertyDescriptor(value, WIZ_IMMUTABLE_VALUE)
    return (
      declaration?.value === true &&
      declaration.configurable === false &&
      declaration.enumerable === false &&
      declaration.writable === false
    )
  }
}

Object.freeze(WizImmutableValue.prototype)
Object.freeze(WizImmutableValue)
