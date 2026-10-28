/** 演出の中断は成功と区別する。呼び出し元は次のゲーム操作へ進まない。 */
export class AnimationAborted extends Error {
  constructor() {
    super("Animation aborted")
    this.name = "AnimationAborted"
  }
}

export const animationClock = { scale: 1 }

export const stillClock = { on: false }

export type Playback = PromiseLike<void> & {
  finished: Promise<void>
  cancel: () => void
  readonly state: "running" | "completed" | "cancelled"
  readonly infinite: boolean
}

export const collecting: AnimationScope[] = []

/** 一つの演出が所有する再生。無限ループは完了待ちから除き、終了・中断時に停止する。 */
export class AnimationScope {
  readonly controller = new AbortController()
  private readonly tasks = new Set<Playback>()
  private detach?: () => void
  constructor(signal?: AbortSignal) {
    if (signal) {
      const abort = () => this.cancel()
      signal.addEventListener("abort", abort, { once: true })
      this.detach = () => signal.removeEventListener("abort", abort)
      if (signal.aborted) this.cancel()
    }
  }
  get signal() {
    return this.controller.signal
  }
  assertActive() {
    if (this.signal.aborted) throw new AnimationAborted()
  }
  add(task: Playback) {
    if (this.signal.aborted) task.cancel()
    else this.tasks.add(task)
    return task
  }
  capture<Result>(run: () => Result): Result {
    this.assertActive()
    collecting.push(this)
    try {
      return run()
    } finally {
      collecting.pop()
    }
  }
  async wait() {
    this.assertActive()
    // 完了のコールバックが次の再生を登録しても取りこぼさない。
    const waited = new Set<Playback>()
    while (true) {
      const pending = [...this.tasks].filter(
        (task) => !task.infinite && !waited.has(task)
      )
      if (!pending.length) break
      for (const task of pending) waited.add(task)
      await Promise.all(pending.map((task) => task.finished))
      this.assertActive()
    }
  }
  cancel = () => {
    this.controller.abort()
    this.detach?.()
    for (const task of this.tasks) task.cancel()
    this.tasks.clear()
  }
  release() {
    this.detach?.()
    for (const task of this.tasks) if (task.infinite) task.cancel()
  }
}

/** Reactが開始する退場も、命令的な再生と同じ完了待ちへ合流する。 */
export class AnimationBarrier {
  private tasks = new Set<Playback>()
  track(task: Playback) {
    this.tasks.add(task)
    void task.finished.finally(() => this.tasks.delete(task)).catch(() => {})
    return task
  }
  async wait() {
    while (this.tasks.size)
      await Promise.all([...this.tasks].map((task) => task.finished))
  }
  cancel() {
    for (const task of this.tasks) task.cancel()
    this.tasks.clear()
  }
}
