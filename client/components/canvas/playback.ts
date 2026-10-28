import type { Playback } from "@/client/components/canvas/animation"
import { collecting } from "@/client/components/canvas/animation"

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
