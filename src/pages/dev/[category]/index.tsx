import { DevCategoryPage } from "@/components/dev/category-page"
import type { Props } from "@/pages/dev/[category]/index.server"

export default function CategoryIndex({ category }: Props) {
  return <DevCategoryPage category={category} />
}
