import type { LayoutPattern } from "@/development/studio/patterns"

/** 状態を偽造せず、ゲームと同じ操作で開くレイアウト。UIとCLI共通の台本。 */
export function pattern(
  slug: string,
  title: string,
  scene: string,
  labels: string[],
  at = 2000 + labels.length * 2000
): LayoutPattern {
  return {
    slug,
    title,
    scene,
    at,
    actions: labels.map((label, index) => ({ at: 2000 + index * 2000, label })),
  }
}
