import { active } from "@/client/components/canvas/play"

export function cancelAnimationsWithin(root: Element) {
  for (const [element, tasks] of active) {
    if (element !== root && !root.contains(element)) continue
    for (const task of new Set(tasks.values())) task.cancel()
    active.delete(element)
  }
}
