type CompareProps = Readonly<{
  inputValue: unknown
  outputValue: unknown
  path: string
  visitedOutputsByInput: WeakMap<object, WeakSet<object>>
}>

/**
 * TypeScript-first content schemaが入力値を書き換えないことを検証する。
 *
 * 省略propertyのdefault追加だけを許可し、literal IDを含む入力値の型とruntime値を一致させる。
 */
export class WorldContentCreateValidation {
  private constructor() {
    throw new TypeError("WorldContentCreateValidation is a static-only validator")
  }

  static assertCanonical(
    input: unknown,
    output: unknown,
    standardCategories: readonly string[],
  ): void {
    this.assertValue({
      inputValue: input,
      outputValue: output,
      path: "$",
      visitedOutputsByInput: new WeakMap(),
    })
    this.assertEmptyStandardDefaults(input, output, standardCategories)
  }

  private static assertValue(props: CompareProps): void {
    if (Object.is(props.inputValue, props.outputValue)) return
    if (!this.isObject(props.inputValue) || !this.isObject(props.outputValue)) {
      throw new TypeError(this.transformMessage(props.path))
    }
    if (this.wasVisited(props)) return
    if (Array.isArray(props.inputValue)) {
      this.assertArray(props)
      return
    }
    if (
      Array.isArray(props.outputValue) ||
      !this.isPlainObject(props.inputValue) ||
      !this.isPlainObject(props.outputValue)
    ) {
      throw new TypeError(this.transformMessage(props.path))
    }
    this.assertObject(props)
  }

  private static assertArray(props: CompareProps): void {
    if (!Array.isArray(props.inputValue) || !Array.isArray(props.outputValue)) {
      throw new TypeError(this.transformMessage(props.path))
    }
    if (props.inputValue.length !== props.outputValue.length) {
      throw new TypeError(this.transformMessage(props.path))
    }
    for (const entry of props.inputValue.entries()) {
      this.assertValue({
        inputValue: entry[1],
        outputValue: props.outputValue[entry[0]],
        path: `${props.path}[${entry[0]}]`,
        visitedOutputsByInput: props.visitedOutputsByInput,
      })
    }
  }

  private static assertObject(props: CompareProps): void {
    if (!this.isObject(props.inputValue) || !this.isObject(props.outputValue)) {
      throw new TypeError(this.transformMessage(props.path))
    }
    for (const key of Reflect.ownKeys(props.inputValue)) {
      if (!Object.hasOwn(props.outputValue, key)) {
        throw new TypeError(this.transformMessage(this.propertyPath(props.path, key)))
      }
      this.assertValue({
        inputValue: Reflect.get(props.inputValue, key),
        outputValue: Reflect.get(props.outputValue, key),
        path: this.propertyPath(props.path, key),
        visitedOutputsByInput: props.visitedOutputsByInput,
      })
    }
  }

  private static assertEmptyStandardDefaults(
    input: unknown,
    output: unknown,
    standardCategories: readonly string[],
  ): void {
    if (!this.isObject(input) || !this.isObject(output)) return
    for (const category of standardCategories) {
      if (Object.hasOwn(input, category)) continue
      const outputCategory = Reflect.get(output, category)
      if (!Array.isArray(outputCategory) || outputCategory.length !== 0) {
        throw new TypeError(this.transformMessage(`$.${category}`))
      }
    }
  }

  private static wasVisited(props: CompareProps): boolean {
    if (!this.isObject(props.inputValue) || !this.isObject(props.outputValue)) return false
    const visitedOutputs = props.visitedOutputsByInput.get(props.inputValue)
    if (visitedOutputs?.has(props.outputValue)) return true
    const nextVisitedOutputs = visitedOutputs ?? new WeakSet<object>()
    nextVisitedOutputs.add(props.outputValue)
    props.visitedOutputsByInput.set(props.inputValue, nextVisitedOutputs)
    return false
  }

  private static isObject(value: unknown): value is object {
    return typeof value === "object" && value !== null
  }

  private static isPlainObject(value: object): boolean {
    const prototype = Object.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
  }

  private static propertyPath(parent: string, key: PropertyKey): string {
    if (typeof key === "string" && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) {
      return `${parent}.${key}`
    }
    return `${parent}[${JSON.stringify(String(key))}]`
  }

  private static transformMessage(path: string): string {
    return `WorldContent.create schema must preserve the supplied value at ${path}; use WorldContent.parse() for transforms`
  }
}

Object.freeze(WorldContentCreateValidation.prototype)
Object.freeze(WorldContentCreateValidation)
