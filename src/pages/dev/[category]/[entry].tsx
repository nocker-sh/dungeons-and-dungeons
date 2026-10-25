import { DevCategoryPage } from "@/components/dev/category-page"
import { DevFrame } from "@/components/dev/frame"
import { DevStudio } from "@/components/dev/studio"
import type { Props } from "@/pages/dev/[category]/[entry].server"

export default function EntryPage({ category, entry }: Props) {
  if (category === "studio") return <DevStudio scene={entry} />
  if (category === "frame") return <DevFrame scene={entry} />
  return <DevCategoryPage category={category} selectedSlug={entry} />
}
