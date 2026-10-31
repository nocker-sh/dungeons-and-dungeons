import { DevPreview } from "@/client/components/dev/dev-preview"
import type { Props as SourceProps } from "@/pages/dev/view-page.server"

type Props = SourceProps

/** 操作部を持たないグラフィック検査。catalog=1で再現条件を列挙する。 */
export default function ViewPage(props: Props) {
  if (props.catalog)
    return (
      <pre
        aria-label="プレビューの指定一覧"
        style={{ overflow: "auto", height: "100dvh" }}
      >
        {JSON.stringify(props.catalog, null, 2)}
      </pre>
    )
  return <DevPreview request={props.request} error={props.error} mode="view" />
}
