import { getPreviewRequest } from "@/development/studio/get-preview-request"

/** URL検証はサーバーで行い、検査用の親ページへゲーム全体を読み込ませない。 */
export function getPreviewPage(query: URLSearchParams, scene: string | null) {
  const request = getPreviewRequest(query, scene)
  if (request instanceof Error) return { request: null, error: request.message }
  return { request, error: null }
}
