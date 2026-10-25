import { StateIntegrityError, type Game } from "@/lib/wiz"

export type SaveStorage = Readonly<{
  read: () => string | null
  write: (value: string) => void
  clear: () => void
}>

/** ブラウザの保存先。localStorage に触るのはここだけ。 */
export class BrowserStorage implements SaveStorage {
  constructor(private readonly key = "dungeons-and-dungeons/save") {}

  read() {
    return localStorage.getItem(this.key)
  }

  write(value: string) {
    localStorage.setItem(this.key, value)
  }

  clear() {
    localStorage.removeItem(this.key)
  }
}

/**
 * 開発サーバーのファイルを保存先にする（`?save=tmp`、開発中だけ）。
 * 読むのは起動前に一度だけ（`load`）。書くのは開発サーバーへ送るだけで、待たない。
 * CLI（`bun builder/cli.ts ai`）と同じ保存を使うので、AI が進めた場面をブラウザで見られる。
 */
export class DevFileStorage implements SaveStorage {
  private constructor(private value: string | null) {}

  static async load() {
    const response = await fetch("/__dev/save")
    return new DevFileStorage(
      response.status === 200 ? await response.text() : null
    )
  }

  read() {
    return this.value
  }

  write(value: string) {
    this.value = value
    void fetch("/__dev/save", { method: "PUT", body: value })
  }

  clear() {
    this.value = null
    void fetch("/__dev/save", { method: "DELETE" })
  }
}

/** 開発中に、保存を /tmp の JSON と共有する指定（URL の ?save=tmp）。 */
export function wantsDevFileSave() {
  return (
    import.meta.env.DEV &&
    new URLSearchParams(location.search).get("save") === "tmp"
  )
}

export class MemoryStorage implements SaveStorage {
  value: string | null = null
  read() {
    return this.value
  }
  write(value: string) {
    this.value = value
  }
  clear() {
    this.value = null
  }
}

export type SessionStatus = "fresh" | "restored" | "unreadable"

export type Session = {
  status: SessionStatus
  /** 読めなかった理由。 */
  problems: readonly string[]
  disconnect: () => void
}

function reasons(error: unknown): string[] {
  if (error instanceof StateIntegrityError) return [...error.problems]
  const code = (error as { code?: string } | null)?.code
  if (code === "CONTENT_VERSION_MISMATCH")
    return ["以前の版のゲームで保存したデータです（保存の形が変わりました）"]
  if (code === "SCHEMA_VERSION_MISMATCH") return ["保存の形式が違います"]
  if (error instanceof SyntaxError) return ["保存データが壊れています"]
  if (error instanceof Error) return [error.message.split("\n")[0]]
  return ["保存データの形が読めません"]
}

function autosave(game: Game, storage: SaveStorage) {
  return game.subscribe(() => {
    try {
      storage.write(JSON.stringify(game.save()))
    } catch {
      // 書けなければ次の変化でもう一度書く
    }
  })
}

/**
 * 保存データを読み込み、以後の変化を書き戻す。
 * 読めない保存は上書きしない（自動保存をつながない）。消すかどうかは遊ぶ人が選ぶ。
 */
export function connectSave(game: Game, storage: SaveStorage): Session {
  let raw: string | null = null
  try {
    raw = storage.read()
  } catch (error) {
    return {
      status: "unreadable",
      problems: reasons(error),
      disconnect: () => {},
    }
  }
  let status: SessionStatus = "fresh"
  if (raw !== null) {
    try {
      const error = game.restore(JSON.parse(raw))
      if (error)
        return {
          status: "unreadable",
          problems: reasons(error.cause),
          disconnect: () => {},
        }
      status = "restored"
    } catch (error) {
      return {
        status: "unreadable",
        problems: reasons(error),
        disconnect: () => {},
      }
    }
  }
  return { status, problems: [], disconnect: autosave(game, storage) }
}

/** 読めない保存を消して、今の（はじめからの）状態で保存し直す。遊ぶ人が選んだときだけ呼ぶ。 */
export function discardSave(game: Game, storage: SaveStorage): Session {
  storage.clear()
  storage.write(JSON.stringify(game.save()))
  return { status: "fresh", problems: [], disconnect: autosave(game, storage) }
}
