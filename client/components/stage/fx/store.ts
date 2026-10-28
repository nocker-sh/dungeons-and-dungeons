import type { ReactNode } from "react"
import { playback } from "@/client/components/canvas/playback"
import type { Playback } from "@/client/components/canvas/animation"

type Item = { id: number; node: ReactNode }

/** 一度きりのエフェクトの一覧。要素は自分の動きが終わると一覧から消える。 */
export class FxStore {
  #items: Item[] = []
  #listeners = new Set<() => void>()
  #serial = 0
  #tasks = new Map<number, Playback>()

  subscribe = (listener: () => void) => {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  getSnapshot = () => this.#items

  add(
    render: (done: () => void) => ReactNode,
    options: { collect?: boolean } = {}
  ) {
    const id = ++this.#serial
    let resolve!: () => void
    const finished = new Promise<void>((done) => {
      resolve = done
    })
    const remove = () => {
      this.#items = this.#items.filter((item) => item.id !== id)
      this.#tasks.delete(id)
      this.#emit()
    }
    const task = playback(finished, remove, options)
    const done = () => {
      resolve()
      remove()
    }
    this.#tasks.set(id, task)
    this.#items = [...this.#items, { id, node: render(done) }]
    this.#emit()
    return task
  }

  clear() {
    for (const task of this.#tasks.values()) task.cancel()
    this.#items = []
    this.#emit()
  }

  #emit() {
    for (const listener of this.#listeners) listener()
  }
}
