export type WizIdGeneratorDefinition = Readonly<{
  readonly source?: () => string
}>

/**
 * バトル・ステータス効果などが共有する ID source の最小契約。
 */
export type WizIdSource = Readonly<{
  readonly next: () => string
}>

/**
 * ID 生成の差し替え可能な抽象。
 *
 * ステータス効果やバトルなど内部 ID の生成元を一箇所に集約する。
 * デフォルトは `crypto.randomUUID`。テスト時は決定論的な ID を得るため
 * {@link WizIdGenerator.fixed} / {@link WizIdGenerator.counter} を使う。
 *
 * @example
 * ```ts
 * // production: UUID
 * const idGen = new WizIdGenerator()
 *
 * // test: カウンターで決定論
 * const idGen = WizIdGenerator.counter(0) // "1", "2", "3", ...
 *
 * // test: 固定値
 * const idGen = WizIdGenerator.fixed("fixed-id")
 *
 * // 任意の source を渡せる
 * const idGen = new WizIdGenerator({ source: () => crypto.randomUUID() })
 * ```
 */
export class WizIdGenerator implements WizIdSource {
  private readonly source: () => string

  constructor(properties: WizIdGeneratorDefinition = {}) {
    this.source = properties.source ?? (() => crypto.randomUUID())
    Object.freeze(this)
  }

  /** 固定値を返すインスタンス。同じ値が繰り返し返るためテスト専用。 */
  static fixed(value: string): WizIdGenerator {
    return new WizIdGenerator({ source: () => value })
  }

  /** 単調増加のカウンターを返すインスタンス。テストの決定論用。 */
  static counter(start: number = 0): WizIdGenerator {
    if (!Number.isSafeInteger(start)) {
      throw new RangeError("ID counter start must be a safe integer")
    }
    let counter = start

    return new WizIdGenerator({
      source: () => {
        counter++
        return String(counter)
      },
    })
  }

  /** 次の ID を取得する。分割代入しても `bind` は不要。 */
  readonly next = (): string => {
    const value = this.source()
    if (typeof value !== "string" || value.trim().length === 0 || value !== value.trim()) {
      throw new TypeError("ID source must return a non-empty string without surrounding whitespace")
    }
    return value
  }
}

Object.freeze(WizIdGenerator.prototype)
Object.freeze(WizIdGenerator)
