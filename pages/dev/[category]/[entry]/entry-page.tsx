import PlayPage from "@/pages/dev/play/[scene]/play-page"
import { DevCategoryPage } from "@/client/components/dev/dev-category-page"
import { DevFrame } from "@/client/components/dev/dev-frame"
import { DevStudio } from "@/client/components/dev/dev-studio"
import type { Props as SourceProps } from "@/pages/dev/[category]/[entry]/entry-page.server"

type Props = SourceProps

export default function EntryPage(props: Props) {
  if (props.category === "studio") return <DevStudio scene={props.entry} />
  if (props.category === "play" && props.preview)
    return <PlayPage {...props.preview} />
  if (props.category === "frame") return <DevFrame scene={props.entry} />
  return (
    <DevCategoryPage category={props.category} selectedSlug={props.entry} />
  )
}
