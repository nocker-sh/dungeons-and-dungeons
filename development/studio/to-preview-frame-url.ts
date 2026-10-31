import type { PreviewRequest } from "@/development/studio/preview-request"

/** 軽い専用フレームへ渡し、一覧・編集UIの依存を描画待ちへ混ぜない。 */
export function toPreviewFrameUrl(
  request: PreviewRequest,
  mode: "view" | "play"
): string {
  const query = new URLSearchParams({
    scene: request.config.scene,
    config: JSON.stringify(request.config),
    mode,
    at: String(request.at),
    guides: String(Number(request.guides)),
  })
  return `/dev/preview-frame?${query}`
}
