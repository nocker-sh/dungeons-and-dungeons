import type { PreviewBridge } from "@/client/dev/preview-bridge"

type Props = { mode: "view" | "play"; error: string }

/** URLの検証で止まった場合も、AIが起動待ちのままにならないよう同じ窓口を返す。 */
export function connectPreviewError(props: Props): () => void {
  const bridge: PreviewBridge = {
    mode: props.mode,
    ready: false,
    stage: "error",
    error: props.error,
    inspect: () => null,
  }
  window.__devPreview = bridge
  return () => {
    if (window.__devPreview === bridge) delete window.__devPreview
  }
}
