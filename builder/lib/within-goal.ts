import { FUN_GOALS } from "@/builder/lib/fun"

/** 目安に入っているか。 */
export function withinGoal(key: keyof typeof FUN_GOALS, value: number) {
  const [low, high] = FUN_GOALS[key].range
  if (Number.isNaN(value)) return false
  return (low === null || value >= low) && (high === null || value <= high)
}
