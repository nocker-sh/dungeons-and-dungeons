import type { PreviewBridge } from "@/client/dev/preview-bridge"

type Props = { frame: HTMLIFrameElement; mode: "view" | "play" }

/** 検査窓口だけを親へ公開し、viewの入力操作APIを作らない。 */
export function connectPreviewFrame(props: Props): () => void {
  const bridge: PreviewBridge = {
    mode: props.mode,
    get stage() {
      return (
        props.frame.contentDocument?.documentElement?.dataset.devPreviewStage ??
        "connecting"
      )
    },
    get ready() {
      return (
        props.frame.contentDocument?.documentElement?.dataset.devPreview ===
        "ready"
      )
    },
    get error() {
      return (
        props.frame.contentWindow?.__devStudioError ??
        props.frame.contentWindow?.__devStudio?.errors[0] ??
        props.frame.contentDocument?.querySelector('[role="alert"]')
          ?.textContent ??
        null
      )
    },
    inspect: () => props.frame.contentWindow?.__devStudio?.inspect() ?? null,
  }
  window.__devPreview = bridge
  return () => {
    if (window.__devPreview === bridge) delete window.__devPreview
  }
}
