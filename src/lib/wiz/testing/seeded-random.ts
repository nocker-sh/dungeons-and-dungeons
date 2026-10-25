import type { Random } from "@/lib/wiz/rules"

/**
 * 種から決まる乱数（mulberry32）。同じ種なら必ず同じ並びになる。
 * 分布を測るテストや、種つきの再生に使う。
 */
export function seededRandom(seed: number): Random {
  let value = seed >>> 0
  return () => {
    value = (value + 0x6d2b79f5) >>> 0
    let mixed = value
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1)
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  }
}
