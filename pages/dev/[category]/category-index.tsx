import { DevCategoryPage } from "@/client/components/dev/dev-category-page"
import type { Props as SourceProps } from "@/pages/dev/[category]/category-index.server"

type Props = SourceProps

export default function CategoryIndex(props: Props) {
  return <DevCategoryPage category={props.category} />
}
