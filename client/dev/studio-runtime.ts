import { inspectStudioElements } from "@/client/dev/inspect-studio-elements"
import { drawStudioGuides } from "@/client/dev/draw-studio-guides"
import { findStudioAction } from "@/client/dev/find-studio-action"
import type {
  AnimationTrack,
  StudioInspection,
  StudioBridge,
} from "./studio-types"
import type { Game } from "@/lib/wiz/game/game"
import type { StudioConfig } from "@/development/studio/config"
import { StudioClock } from "@/development/studio/clock"
import { artworkSettled } from "@/client/game/artwork-settled"
import { frameData, frameSteps, MotionGlobalConfig } from "motion"

/** motion の描画ループの処理の順（motion-dom の stepsOrder と同じ）。 */
const MOTION_STEPS = [
  "setup",
  "read",
  "resolveKeyframes",
  "preUpdate",
  "update",
  "preRender",
  "render",
  "postRender",
] as const

/** iframe専用。実ゲームのタイマー・rAF・WAAPIを止め、一つの時計で動かす。 */
export class StudioRuntime implements StudioBridge {
  readonly clock = new StudioClock()
  ready = false
  game?: Game
  readonly errors: string[] = []
  readonly operations: StudioInspection["operations"] = []
  private tracks: {
    animation: Animation
    element: Element
    record: AnimationTrack
    born: number
    complete: () => void
    completed: boolean
  }[] = []
  private readonly nativeFrame = window.requestAnimationFrame.bind(window)
  private readonly nativeCancelFrame = window.cancelAnimationFrame.bind(window)
  private readonly nativeTimeout = window.setTimeout.bind(window)
  private readonly initialPaint = document.createElement("style")
  private cancelPaint?: () => void
  private cleanups: (() => void)[] = []
  private busy = false
  private disposed = false
  private serial = 0
  private recordLimit = 10000
  get settled() {
    return this.ready && !this.busy
  }
  private assertActive() {
    if (this.disposed)
      throw new DOMException("スタジオは終了しました", "AbortError")
  }

  constructor(readonly config: StudioConfig) {
    this.install()
    // 初回の途中絵を描かず、指定時刻で画像・配置が確定してから提示する。
    this.initialPaint.dataset.studioInitialPaint = ""
    this.initialPaint.textContent = "html { opacity: 0 !important; }"
    document.head.append(this.initialPaint)
    this.cleanups.push(() => this.showInitialFrame())
    window.__devStudio = this
    for (const action of config.actions)
      this.clock.timeout(() => this.click(action.label), action.at)
  }
  /** 起動失敗の表示にも使う。自分が所有する描画待ちだけを解除する。 */
  showInitialFrame() {
    this.initialPaint.remove()
  }
  private install() {
    const replace = (object: object, key: string, value: unknown) => {
      const descriptor = Object.getOwnPropertyDescriptor(object, key)
      Object.defineProperty(object, key, {
        value,
        configurable: true,
        writable: true,
      })
      this.cleanups.push(() => {
        if (descriptor) Object.defineProperty(object, key, descriptor)
        else Reflect.deleteProperty(object, key)
      })
    }
    replace(performance, "now", () => this.clock.now)
    replace(Date, "now", () => 1700000000000 + this.clock.now)
    let seed = this.config.seed >>> 0
    replace(Math, "random", () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      return seed / 4294967296
    })
    const timeout = (callback: TimerHandler, delay = 0, ...args: unknown[]) => {
      if (typeof callback !== "function")
        throw new Error("スタジオでは文字列タイマーを使えません")
      return this.clock.timeout(() => callback(...args), Number(delay) || 0)
    }
    replace(window, "setTimeout", timeout)
    replace(window, "clearTimeout", (id: number) => this.clock.cancel(id))
    replace(
      window,
      "setInterval",
      (callback: TimerHandler, delay = 0, ...args: unknown[]) => {
        if (typeof callback !== "function")
          throw new Error("スタジオでは文字列タイマーを使えません")
        return this.clock.timeout(
          () => callback(...args),
          Number(delay) || 0,
          Math.max(1, Number(delay) || 0)
        )
      }
    )
    replace(window, "clearInterval", (id: number) => this.clock.cancel(id))
    replace(window, "requestAnimationFrame", (callback: FrameRequestCallback) =>
      this.clock.frame(callback)
    )
    replace(window, "cancelAnimationFrame", (id: number) =>
      this.clock.cancel(id)
    )
    this.driveMotion()
    const originalAnimate = Object.getOwnPropertyDescriptor(
      Element.prototype,
      "animate"
    )!.value as Element["animate"]
    const register = this.register.bind(this)
    replace(
      Element.prototype,
      "animate",
      function (
        this: Element,
        keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
        options?: number | KeyframeAnimationOptions
      ) {
        const animation = originalAnimate.call(this, keyframes, options)
        animation.pause()
        animation.currentTime = 0
        register(animation, this)
        const pause = animation.pause.bind(animation)
        animation.play = () => {
          pause()
        }
        return animation
      }
    )
    const onError = (event: ErrorEvent) => {
      this.errors.push(event.message)
      this.showInitialFrame()
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      this.errors.push(String(event.reason))
      this.showInitialFrame()
    }
    window.addEventListener("error", onError)
    window.addEventListener("unhandledrejection", onRejection)
    this.cleanups.push(() => {
      window.removeEventListener("error", onError)
      window.removeEventListener("unhandledrejection", onRejection)
    })
  }
  private register(animation: Animation, element: Element) {
    const timing = animation.effect?.getComputedTiming()
    const duration = Number(timing?.activeDuration ?? 0)
    const record: AnimationTrack = {
      id: ++this.serial,
      label:
        element.getAttribute("aria-label") ??
        element.getAttribute("data-debug-label") ??
        element.getAttribute("class") ??
        [
          element.closest("[aria-label]")?.getAttribute("aria-label"),
          element.tagName.toLowerCase(),
        ]
          .filter(Boolean)
          .join(" / "),
      start: this.clock.now + Number(timing?.delay ?? 0),
      duration: Number.isFinite(duration) ? duration : this.config.duration,
      properties: [
        ...new Set(
          (animation.effect as KeyframeEffect | null)
            ?.getKeyframes()
            .flatMap((frame) =>
              Object.keys(frame).filter(
                (key) =>
                  !["offset", "computedOffset", "easing", "composite"].includes(
                    key
                  )
              )
            ) ?? []
        ),
      ],
    }
    let finishHandler: Animation["onfinish"] = null
    let resolveFinished!: () => void
    let virtualStart = this.clock.now
    const finished = new Promise<void>((resolve) => {
      resolveFinished = resolve
    })
    const track = {
      animation,
      element,
      record,
      born: this.clock.now,
      completed: false,
      complete: () => {},
    }
    // nativeのfinish通知は実フレームの後に届く。続きは仮想時刻で同期して通知する。
    Object.defineProperty(animation, "onfinish", {
      configurable: true,
      get: () => finishHandler,
      set: (value) => {
        finishHandler = value
      },
    })
    Object.defineProperty(animation, "finished", {
      configurable: true,
      get: () => finished,
    })
    Object.defineProperty(animation, "startTime", {
      configurable: true,
      get: () => virtualStart,
      set: (value) => {
        if (value !== null) virtualStart = Number(value)
        animation.pause()
      },
    })
    track.complete = () => {
      if (track.completed) return
      track.completed = true
      animation.pause()
      animation.currentTime = Number(
        animation.effect?.getComputedTiming().endTime ?? 0
      )
      const event = new AnimationPlaybackEvent("finish", {
        currentTime: Number(animation.currentTime),
        timelineTime: this.clock.now,
      })
      finishHandler?.call(animation, event)
      animation.dispatchEvent(event)
      resolveFinished()
    }
    animation.finish = track.complete
    this.tracks.push(track)
  }
  /**
   * motion の描画ループは読み込んだ時点の本物の requestAnimationFrame で回るので、
   * 仮想の時計のフレームごとに同じ順で処理を回す。時刻も仮想の時計に合わせる。
   */
  private driveMotion() {
    const manual = MotionGlobalConfig.useManualTiming
    MotionGlobalConfig.useManualTiming = true
    // 本物のフレームからの処理は止める（撮るまでの実時間で、揺れの減衰などの回数が変わるため）
    const originals = MOTION_STEPS.map((step) => frameSteps[step].process)
    let driving = false
    for (const [index, step] of MOTION_STEPS.entries())
      frameSteps[step].process = (data) => {
        if (driving) originals[index](data)
      }
    let task = 0
    const tick = (time: number) => {
      if (!frameData.isProcessing) {
        frameData.delta = Math.max(1, time - frameData.timestamp)
        frameData.timestamp = time
        frameData.isProcessing = true
        driving = true
        try {
          for (const step of MOTION_STEPS) frameSteps[step].process(frameData)
        } finally {
          driving = false
          frameData.isProcessing = false
        }
      }
      task = this.clock.frame(tick)
    }
    frameData.timestamp = this.clock.now
    task = this.clock.frame(tick)
    this.cleanups.push(() => {
      this.clock.cancel(task)
      for (const [index, step] of MOTION_STEPS.entries())
        frameSteps[step].process = originals[index]
      MotionGlobalConfig.useManualTiming = manual
    })
  }

  /** ブラウザのReact commitとPromise継続を実時間のMessageChannelで確定させる。仮想時計は進まない。 */
  private flush = async () => {
    this.assertActive()
    // 絵の読み込みは実時間で終わる。読み終わる前に仮想の時計だけが先へ進まないようにする
    await artworkSettled()
    this.assertActive()
    for (let turn = 0; turn < 2; turn++)
      await new Promise<void>((resolve) => {
        const channel = new MessageChannel()
        channel.port1.onmessage = () => {
          channel.port1.close()
          channel.port2.close()
          resolve()
        }
        channel.port2.postMessage(null)
      })
  }
  private renderAnimations = () => {
    this.assertActive()
    // CSS transition/animationはElement.animateを通らないため、DOMの更新直後に拾う。
    const known = new Set(this.tracks.map((track) => track.animation))
    for (const animation of document.getAnimations()) {
      if (known.has(animation)) continue
      const element = (animation.effect as KeyframeEffect | null)?.target
      if (element) this.register(animation, element)
    }
    for (const track of this.tracks) {
      const { animation, record, born } = track
      const timing = animation.effect?.getComputedTiming()
      const active = Number(timing?.activeDuration ?? 0)
      record.duration = Number.isFinite(active) ? active : this.config.duration
      record.start = born + Number(timing?.delay ?? 0)
      if (track.completed || animation.playState === "idle") continue
      const elapsed = Math.max(
        0,
        this.clock.now -
          record.start +
          Number(animation.effect?.getTiming().delay ?? 0)
      )
      const total = Number(
        animation.effect?.getComputedTiming().endTime ?? Infinity
      )
      if (Number.isFinite(total) && elapsed >= total) {
        track.complete()
      } else {
        animation.pause()
        animation.currentTime = elapsed
      }
    }
  }
  async initialize() {
    this.assertActive()
    for (let attempt = 0; attempt < 300; attempt++) {
      await this.flush()
      if (this.game && document.querySelector('[aria-label="場面"]')) break
      await new Promise<void>((resolve) => this.nativeTimeout(resolve, 10))
    }
    if (!this.game || !document.querySelector('[aria-label="場面"]'))
      throw new Error("ゲームが起動しません")
    await document.fonts.ready
    await Promise.all(
      [...document.images].map((image) =>
        image.decode().catch((error) => {
          throw new Error(`画像を読めません: ${image.src}: ${error}`)
        })
      )
    )
    await this.clock.advance(0, this.flush, this.renderAnimations)
    this.assertActive()
    this.ready = true
    return this.inspect()
  }
  private waitForPaint() {
    return new Promise<void>((resolve, reject) => {
      let frame: number | undefined
      const cancel = () => {
        if (this.cancelPaint !== cancel) return
        this.cancelPaint = undefined
        if (frame !== undefined) this.nativeCancelFrame(frame)
        reject(new DOMException("スタジオは終了しました", "AbortError"))
      }
      this.cancelPaint = cancel
      frame = this.nativeFrame(() => {
        if (this.cancelPaint !== cancel) return
        frame = this.nativeFrame(() => {
          if (this.cancelPaint !== cancel) return
          this.cancelPaint = undefined
          resolve()
        })
      })
    })
  }
  async advance(time: number) {
    this.assertActive()
    if (!this.ready) throw new Error("起動の完了を待ってください")
    if (this.busy) throw new Error("時計の移動中です")
    if (time > this.config.duration)
      throw new Error("指定時刻がタイムラインを超えています")
    this.busy = true
    try {
      await this.clock.advance(time, this.flush, this.renderAnimations)
      await Promise.all(
        [...document.images].map((image) =>
          image.decode().catch((error) => {
            throw new Error(`画像を読めません: ${image.src}: ${error}`)
          })
        )
      )
      this.renderAnimations()
      await Promise.all(
        this.tracks.map((track) => track.animation.ready.catch(() => {}))
      )
      this.renderAnimations()
      // pauseのcommitとCSSフィルターのラスタライズを実フレームで確定する。演出の時計は進まない。
      // この後にcurrentTimeを書き直すと描画が再び未確定になるため、更新せずに返す。
      this.showInitialFrame()
      await this.waitForPaint()
      this.assertActive()
      return this.inspect()
    } finally {
      this.busy = false
      this.showInitialFrame()
    }
  }
  /** 描画が確定した時点のゲーム・配置・演出を取得する。ゲームのDOMは変更しない。 */
  async snapshot() {
    if (!this.settled) throw new Error("時計の移動が終わるのを待ってください")
    if (this.initialPaint.isConnected)
      throw new Error("最初の時刻の描画を待ってください")
    return this.inspect()
  }
  /** 名前（aria-label）か、決まった操作の名前（data-action。狙っている敵の「放つ」など）で押す。 */
  click(label: string) {
    this.assertActive()
    const element = findStudioAction(label)
    const success = !!element
    this.operations.push({ at: this.clock.now, label, success })
    if (!element) {
      this.errors.push(`操作できません (${this.clock.now}ms): ${label}`)
      return
    }
    element.click()
  }
  guides(enabled: boolean) {
    this.assertActive()
    drawStudioGuides(enabled, () => this.inspect().elements)
  }
  configure(config: StudioConfig) {
    this.assertActive()
    // CLIと親iframeの両方で同じ初期条件から再起動する。
    const url = new URL(location.href)
    url.pathname = `/dev/frame/${encodeURIComponent(config.scene)}`
    url.searchParams.set("config", JSON.stringify(config))
    location.replace(url)
  }
  inspect(): StudioInspection {
    const elements = inspectStudioElements()
    return {
      version: 1,
      config: this.config,
      time: this.clock.now,
      ready: this.ready,
      errors: [...this.errors],
      text: document.querySelector(".game")?.textContent ?? "",
      animations: this.tracks
        .slice(-this.recordLimit)
        .map((track) => track.record),
      operations: [...this.operations],
      state: this.game?.state ?? null,
      party: this.game?.queries.party(this.game.state) ?? null,
      battle: this.game?.queries.battle(this.game.state) ?? null,
      elements,
    }
  }
  dispose() {
    // 中断直後にimportなどが完了し、もう一度呼ばれても次の時計を解除しない。
    if (this.disposed) return
    this.disposed = true
    this.ready = false
    this.cancelPaint?.()
    this.clock.dispose()
    for (const track of this.tracks.splice(0)) track.animation.cancel()
    for (const cleanup of this.cleanups.splice(0).reverse()) cleanup()
    if (window.__devStudio === this) delete window.__devStudio
  }
}
