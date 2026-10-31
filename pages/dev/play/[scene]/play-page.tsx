import { DevPreview } from "@/client/components/dev/dev-preview"
import type { Props as SourceProps } from "@/pages/dev/play/[scene]/play-page.server"

type Props = SourceProps

/** グラフィック検査と同じ種・初期状態から実際に操作する。 */
export default function PlayPage(props: Props) {
  return <DevPreview request={props.request} error={props.error} mode="play" />
}
