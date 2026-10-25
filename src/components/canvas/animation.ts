import { animate, frame, cancelFrame } from "motion"

/** 演出の中断は成功と区別する。呼び出し元は次のゲーム操作へ進まない。 */
export class AnimationAborted extends Error {
  constructor() {
    super("Animation aborted")
    this.name = "AnimationAborted"
  }
}

let timeScale = 1
export function setTimeScale(scale: number) {
  timeScale = scale
}
export function scaledMs(milliseconds: number) {
  return milliseconds * timeScale
}
export const stillClock = { on: false }

export type Playback = PromiseLike<void> & {
  finished: Promise<void>
  cancel: () => void
  readonly state: "running" | "completed" | "cancelled"
  readonly infinite: boolean
}

const collecting: AnimationScope[] = []

/** Motionの完了通知だけを使う。キャンセルでも待ちを解放し、完了処理とは区別する。 */
export function playback(
  source: PromiseLike<unknown>,
  stop: () => void,
  options: { infinite?: boolean; complete?: () => void; collect?: boolean } = {}
): Playback {
  let state: Playback["state"] = "running"
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const finished = new Promise<void>((done, fail) => {
    resolve = done
    reject = fail
  })
  const task: Playback = {
    finished,
    infinite: options.infinite ?? false,
    get state() {
      return state
    },
    // Motionと同じくawait可能な再生ハンドル。
    // eslint-disable-next-line unicorn/no-thenable
    then: finished.then.bind(finished),
    cancel() {
      if (state === "cancelled") return
      const running = state === "running"
      state = "cancelled"
      stop()
      if (running) resolve()
    },
  }
  Promise.resolve(source).then(
    () => {
      if (state !== "running") return
      state = "completed"
      try {
        options.complete?.()
        resolve()
      } catch (error) {
        reject(error)
      }
    },
    (error: unknown) => {
      if (state !== "running") return
      state = "cancelled"
      reject(error)
    }
  )
  // 装飾として起動した再生でもunhandled rejectionを残さない。await側には同じ失敗を返す。
  void finished.catch(() => {})
  if (options.collect !== false) for (const scope of collecting) scope.add(task)
  return task
}

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

/** 同じ拍の演出をまとめ、最も遅い実際の完了を待つ。 */
export function parallel(run: () => unknown, signal?: AbortSignal): Playback {
  const scope = new AnimationScope(signal)
  let result: unknown
  try {
    result = scope.capture(run)
  } catch (error) {
    scope.cancel()
    throw error
  }
  const finished = (async () => {
    try {
      if (
        result &&
        typeof result === "object" &&
        "then" in result &&
        typeof result.then === "function"
      )
        await (result as PromiseLike<unknown>)
      await scope.wait()
      scope.release()
    } catch (error) {
      scope.cancel()
      throw error
    }
  })()
  return playback(finished, scope.cancel)
}

/** 前の拍が完了したときだけ次へ。キャンセルした古い演出から状態を更新しない。 */
export function after(
  task: Playback,
  next: () => unknown,
  signal?: AbortSignal
): Playback {
  const scope = new AnimationScope(signal)
  scope.add(task)
  const finished = (async () => {
    try {
      await task.finished
      scope.assertActive()
      if (task.state !== "completed") throw new AnimationAborted()
      await scope.capture(() => parallel(next, scope.signal))
      scope.assertActive()
      scope.release()
    } catch (error) {
      scope.cancel()
      throw error
    }
  })()
  return playback(finished, scope.cancel)
}

/** 数字・カメラ・文字送りもMotionの時計と完了通知で動かす。 */
export function tween(
  from: number,
  to: number,
  duration: number,
  update: (value: number) => void,
  options: {
    delay?: number
    ease?: (value: number) => number
    repeat?: number
  } = {}
): Playback {
  const controls = animate(from, to, {
    duration: scaledMs(duration) / 1000,
    delay: scaledMs(options.delay ?? 0) / 1000,
    ease: options.ease ?? "linear",
    repeat: options.repeat,
    onUpdate: update,
  })
  return playback(controls.finished, () => controls.stop(), {
    infinite: options.repeat === Infinity,
  })
}

/** 読むための間など、動きの完了待ちではない意図的な保持。 */
export function hold(duration: number, signal?: AbortSignal): Playback {
  const task = tween(0, 1, duration, () => {})
  if (signal) {
    const abort = () => task.cancel()
    signal.addEventListener("abort", abort, { once: true })
    if (signal.aborted) abort()
    void task.finished
      .finally(() => signal.removeEventListener("abort", abort))
      .catch(() => {})
  }
  return task
}

/** DOM反映を待つ。時間の推測ではなくMotionの次の描画フレームに同期する。 */
export function nextFrame(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener("abort", abort)
    const render = () => {
      cleanup()
      resolve()
    }
    const abort = () => {
      cancelFrame(render)
      cleanup()
      reject(new AnimationAborted())
    }
    if (signal?.aborted) return abort()
    signal?.addEventListener("abort", abort, { once: true })
    frame.postRender(render)
  })
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
