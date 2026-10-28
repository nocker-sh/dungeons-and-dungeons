import type { StatBlock } from "@/lib/wiz/state/stat-block"

/** 宿で上がったレベルと、その前後の能力。 */
export type LevelUp = Readonly<{
  member: string
  from: number
  to: number
  before: StatBlock
  after: StatBlock
}>
