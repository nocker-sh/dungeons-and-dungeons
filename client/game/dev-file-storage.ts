import type { SaveStorage } from "./save-storage"

/**
 * 開発サーバーのファイルを保存先にする（`?save=tmp`、開発中だけ）。
 * 読むのは起動前に一度だけ（`load`）。変更は呼び出し順に保存する。
 * CLI（`vp run cli ai`）と同じ保存を使うので、AI が進めた場面をブラウザで見られる。
 */
export class DevFileStorage implements SaveStorage {
  private pending: Promise<void> = Promise.resolve()

  private constructor(
    private value: string | null,
    private readError?: unknown
  ) {}

  static async load() {
    try {
      const response = await fetch("/__dev/save")
      if (response.status === 204) return new DevFileStorage(null)
      if (response.status !== 200)
        throw new Error(`保存を読み込めませんでした（${response.status}）`)
      return new DevFileStorage(await response.text())
    } catch (error) {
      return new DevFileStorage(null, error)
    }
  }

  read() {
    if (this.readError !== undefined) throw this.readError
    return this.value
  }

  write(value: string) {
    return this.change("PUT", value)
  }

  clear() {
    return this.change("DELETE", null)
  }

  private change(method: "PUT" | "DELETE", value: string | null) {
    const request = this.pending.then(async () => {
      const response = await fetch("/__dev/save", {
        method,
        ...(value === null ? {} : { body: value }),
      })
      if (!response.ok)
        throw new Error(`保存を変更できませんでした（${response.status}）`)
      this.value = value
      this.readError = undefined
    })
    // 失敗は呼び出し側へ返し、次の保存は再試行できるようにする。
    this.pending = request.catch(() => {})
    return request
  }
}

/** 開発中に、保存を /tmp の JSON と共有する指定（URL の ?save=tmp）。 */
export function wantsDevFileSave() {
  return (
    import.meta.env.DEV &&
    new URLSearchParams(location.search).get("save") === "tmp"
  )
}
