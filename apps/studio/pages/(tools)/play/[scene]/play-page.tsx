import { DevPreview } from "@/development/components/dev-preview"
import type { Props as SourceProps } from "@/apps/studio/pages/(tools)/play/[scene]/play-page.server"

type Props = SourceProps

/** グラフィック検査と同じ種・初期状態から実際に操作する。 */
export default function PlayPage(props: Props) {
  return <DevPreview request={props.request} error={props.error} mode="play" />
}
