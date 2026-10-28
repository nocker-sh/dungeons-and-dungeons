import type { Random } from "@/lib/wiz/rules/random"

export function pick<T>(random: Random, list: readonly T[]): T {
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))]
}
