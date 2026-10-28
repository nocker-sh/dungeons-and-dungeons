import type { SaveStore } from "@/lib/wiz/definition/save-store"

/** 覚えているだけの保存先。ブラウザに触らずに保存・復元を試せる。 */
export class InMemorySaveStore implements SaveStore {
  #value: string | null
  /** 書き込んだ回数。自動保存の検証に使う。 */
  writes = 0

  constructor(initial: string | null = null) {
    this.#value = initial
  }

  read() {
    return this.#value
  }

  write(value: string) {
    this.#value = value
    this.writes += 1
  }

  clear() {
    this.#value = null
  }

  /** いま入っている保存を JSON として読む。空なら null。 */
  parsed(): unknown {
    return this.#value === null ? null : JSON.parse(this.#value)
  }
}
