/** 再現できる乱数（mulberry32）。state を保存すれば続きから回せる。 */
export class SeededRandom {
  state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  next = (): number => {
    this.state = (this.state + 0x6d2b79f5) >>> 0
    let value = this.state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }

  /** 方針の揺らぎなど、ゲームの外で使う乱数。ゲームの乱数とは別の列にする。 */
  fork(salt: number) {
    return new SeededRandom((this.state ^ Math.imul(salt, 0x9e3779b1)) >>> 0)
  }
}
