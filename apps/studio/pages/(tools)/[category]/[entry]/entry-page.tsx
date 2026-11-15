import PlayPage from "@/apps/studio/pages/(tools)/play/[scene]/play-page"
import { DevCategoryPage } from "@/development/components/dev-category-page"
import { DevFrame } from "@/development/components/dev-frame"
import { DevStudio } from "@/development/components/dev-studio"
import type { Props as SourceProps } from "@/apps/studio/pages/(tools)/[category]/[entry]/entry-page.server"

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
