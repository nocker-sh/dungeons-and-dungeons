import type { SaveStorage } from "./save-storage"

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
