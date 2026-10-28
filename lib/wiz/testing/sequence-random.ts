import type { Random } from "@/lib/wiz/rules/random"

/**
 * 決めた順番の値を返す乱数。台本どおりの引きを作るテスト用。
 * 使い切ったら `fallback`（既定 0）を返し続ける。
 */
export class SequenceRandom {
  #index = 0

  constructor(
    private readonly values: readonly number[],
    private readonly fallback = 0
  ) {}

  /** 乱数として渡す関数。 */
  readonly next: Random = () => {
    const value = this.values[this.#index]
    this.#index += 1
    return value ?? this.fallback
  }

  /** これまでに使った個数。 */
  get used() {
    return this.#index
  }

  /** まだ使っていない値。 */
  get remaining(): readonly number[] {
    return this.values.slice(this.#index)
  }

  reset() {
    this.#index = 0
  }
}

/** 決めた順番の値を返す乱数関数を作る近道。 */
export function sequenceRandom(
  values: readonly number[],
  fallback = 0
): Random {
  return new SequenceRandom(values, fallback).next
}
