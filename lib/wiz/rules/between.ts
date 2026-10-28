import type { Random } from "@/lib/wiz/rules/random"

export function between(random: Random, min: number, max: number) {
  return min + Math.floor(random() * (max - min + 1))
}
