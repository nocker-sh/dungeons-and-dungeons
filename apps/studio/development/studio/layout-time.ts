import { layoutPattern } from "@/development/studio/layout-pattern"

export function layoutTime(slug: string) {
  return layoutPattern(slug)?.at ?? 2000
}
