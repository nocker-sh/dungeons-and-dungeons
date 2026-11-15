import { MemoryStorage } from "./memory-storage"
import type { SaveStorage } from "./save-storage"

const studioOrigin = "https://dev.dnd.localhost"
const waitMs = 10_000

/**
 * `?save=message` で開発スタジオのiframeに開かれたとき、親からセーブを受け取る。
 * 受け取ったセーブはメモリだけで遊び、このブラウザの本来のセーブには触れない。
 * 開発サーバー以外（本番ビルドではコードごと消える）・開発用のホスト以外・iframe外・別の送り主からは受け取らない。
 */
export function receiveMessageSave(): Promise<SaveStorage> | null {
  if (
    !import.meta.env.DEV ||
    new URLSearchParams(location.search).get("save") !== "message"
  )
    return null
  return new Promise((resolve) => {
    const fail = (message: string) => {
      const storage = new MemoryStorage()
      storage.read = () => {
        throw new Error(message)
      }
      resolve(storage)
    }
    if (location.hostname !== "dnd.localhost" || window.parent === window) {
      fail("セーブは開発スタジオのiframeからだけ受け取れます。")
      return
    }
    const timer = setTimeout(() => {
      removeEventListener("message", receive)
      fail("開発スタジオからセーブが届きませんでした。")
    }, waitMs)
    function receive(event: MessageEvent) {
      if (
        event.origin !== studioOrigin ||
        event.source !== window.parent ||
        event.data?.type !== "dnd-save" ||
        typeof event.data.save !== "string"
      )
        return
      clearTimeout(timer)
      removeEventListener("message", receive)
      const storage = new MemoryStorage()
      storage.value = event.data.save
      resolve(storage)
    }
    addEventListener("message", receive)
    window.parent.postMessage({ type: "dnd-save-ready" }, studioOrigin)
  })
}
