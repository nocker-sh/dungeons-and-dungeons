import { randomBetween } from "@/client/components/stage/random-between"

/** 7つの頂点を大きく揺らし、どの辺も平行にならない形。 */
export function brokenShape() {
  const j = (a: number, b: number) => randomBetween(a, b).toFixed(1)
  return {
    sp: `polygon(${j(0, 10)}% ${j(12, 42)}%, ${j(28, 52)}% ${j(-10, 6)}%, ${j(86, 98)}% ${j(14, 40)}%, ${j(98, 112)}% ${j(58, 80)}%, ${j(70, 88)}% ${j(100, 114)}%, ${j(18, 40)}% ${j(86, 100)}%, ${j(-10, 3)}% ${j(66, 92)}%)`,
    sl: `${j(-12, -2)}%`,
    sr: `${j(-18, -6)}%`,
    st: `${j(8, 24)}%`,
    sb: `${j(-26, -12)}%`,
  }
}
