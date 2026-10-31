import { connectPreviewError } from "@/client/dev/connect-preview-error"
import type { PreviewRequest } from "@/development/studio/preview-request"
import { toPreviewFrameUrl } from "@/development/studio/to-preview-frame-url"
import { connectPreviewFrame } from "@/client/dev/connect-preview-frame"
import { Alert } from "@/client/components/ui/alert"

type Props = {
  request: PreviewRequest | null
  error: string | null
  mode: "view" | "play"
}

/** 設定した実寸で描く。親のレイアウトをゲームのviewportへ混ぜない。 */
export function DevPreview(props: Props) {
  const request = props.request
  if (!request)
    return (
      <Alert
        role="alert"
        ref={() =>
          connectPreviewError({
            mode: props.mode,
            error: props.error ?? "プレビューを起動できません",
          })
        }
        style={{ margin: 16, whiteSpace: "pre-wrap" }}
      >
        {props.error}
      </Alert>
    )
  const source = toPreviewFrameUrl(request, props.mode)
  return (
    <iframe
      key={source}
      title={props.mode === "view" ? "グラフィックの確認" : "動作の確認"}
      src={source}
      width={request.config.width}
      height={request.config.height}
      ref={(frame) => {
        if (frame) return connectPreviewFrame({ frame, mode: props.mode })
      }}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: request.config.width,
        height: request.config.height,
        border: 0,
        display: "block",
      }}
    />
  )
}
