import { DevCategoryPage } from "@/development/components/dev-category-page"
import type { Props as SourceProps } from "@/apps/studio/pages/(tools)/[category]/category-index.server"

type Props = SourceProps

export default function CategoryIndex(props: Props) {
  return <DevCategoryPage category={props.category} />
}
