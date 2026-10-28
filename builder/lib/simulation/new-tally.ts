import type { Tally } from "@/builder/lib/simulation/battle"

export function newTally(): Tally {
  return {
    damage: new Map(),
    healing: new Map(),
    taken: new Map(),
    uses: new Map(),
  }
}
