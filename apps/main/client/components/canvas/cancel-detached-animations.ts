import { active } from "@/client/components/canvas/play"

/** DOMから外れた要素のループ・遅延・完了後のスタイル所有を片付ける。 */
export function cancelDetachedAnimations() {
  for (const [element, tasks] of active) {
    if (element.isConnected) continue
    for (const task of new Set(tasks.values())) task.cancel()
    active.delete(element)
  }
}
