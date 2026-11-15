type Task = { id: number; at: number; callback: () => void; interval?: number }
/** 演出用の時計。ゲームの規則や保存には依存しない。 */
export class StudioClock {
  now = 0
  private serial = 0
  private tasks = new Map<number, Task>()
  private readonly frameDuration = 1000 / 60
  private readonly cancellation = new AbortController()

  timeout(callback: () => void, delay = 0, interval?: number) {
    const id = ++this.serial
    if (this.cancellation.signal.aborted) return id
    this.tasks.set(id, {
      id,
      at: this.now + Math.max(0, delay),
      callback,
      interval,
    })
    return id
  }
  frame(callback: (time: number) => void) {
    const next =
      (Math.floor((this.now + 0.00001) / this.frameDuration) + 1) *
      this.frameDuration
    return this.timeout(() => callback(this.now), next - this.now)
  }
  cancel(id: number) {
    this.tasks.delete(id)
  }
  get pending() {
    return this.tasks.size
  }
  dispose() {
    this.cancellation.abort()
    this.tasks.clear()
  }
  async advance(
    target: number,
    flush: () => Promise<void>,
    render: () => void = () => {}
  ) {
    const signal = this.cancellation.signal
    signal.throwIfAborted()
    if (!Number.isFinite(target) || target < this.now || target > 60000)
      throw new Error(
        "時計は0〜60000msの範囲で前へ進めます。逆戻りは再起動してください"
      )
    let steps = 0
    while (true) {
      signal.throwIfAborted()
      const next = [...this.tasks.values()]
        .filter((task) => task.at <= target)
        .sort((a, b) => a.at - b.at || a.id - b.id)[0]
      if (!next) {
        // 待ちの続きが新しく予約するかもしれないので、確定させてから飛ぶ
        const scheduled = this.serial
        await flush()
        signal.throwIfAborted()
        if (this.serial === scheduled) break
        if (++steps > 100000) throw new Error("タイマーが収束しません")
        continue
      }
      if (++steps > 100000) throw new Error("タイマーが収束しません")
      this.now = next.at
      this.tasks.delete(next.id)
      if (next.interval !== undefined)
        this.tasks.set(next.id, {
          ...next,
          at: this.now + Math.max(1, next.interval),
        })
      render()
      signal.throwIfAborted()
      next.callback()
      signal.throwIfAborted()
      await flush()
      signal.throwIfAborted()
      render()
    }
    this.now = target
    render()
    signal.throwIfAborted()
    await flush()
    signal.throwIfAborted()
    render()
  }
}
