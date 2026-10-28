import { useEffect, type RefObject } from "react"
import { play } from "@/client/components/canvas/play"

/**
 * 選択中（アクティブ）とキーボード・コントローラー操作。
 * - 既定では各画面の主役ボタン（白い紙のボタン）がアクティブ
 * - マウスを当てたものがアクティブになる
 * - 矢印キー／WASD／十字キー・左スティックで近い方向へ移る。Enter／Space／Aで決定、Esc／Bで戻る。1〜4で仲間
 * - 戦闘の敵は、アクティブにすると狙いが移る（フォーカスを渡す）
 * - パッドのL/Rで操作項目を前後に選ぶ。上下を一覧が使う画面でも、ほかの操作へ移れる。
 */
const SELECTOR =
  ".word, .slot-item, .tabbtn, .formation .card .hit, .formation .bagbtn, .revolver .dest, .map .node.pick, [data-route-choice], [data-route-survey], [data-loot-page], [data-foe-pick], [data-nav-button]"
const GAMEPAD_SCROLL_DEADZONE = 0.2
const GAMEPAD_SCROLL_PIXELS_PER_SECOND = 600

function alive(el: HTMLElement, allowDisabled = false) {
  if (!el.isConnected || el.closest("[data-leaving], [inert]")) return false
  if (!allowDisabled && (el as HTMLButtonElement).disabled) return false
  const style = getComputedStyle(el)
  return style.visibility !== "hidden" && Number(style.opacity) > 0.1
}

export function useKeyboardNav(view: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = view.current?.closest(".game") as HTMLElement | null
    if (!root) return
    let active: HTMLElement | null = null
    let activeList: HTMLElement | null = null
    const modal = () => {
      const dialogs = [
        ...root.querySelectorAll<HTMLElement>('[aria-modal="true"]'),
      ].filter((dialog) => !dialog.closest("[inert]"))
      return (
        dialogs.find((dialog) =>
          dialog.hasAttribute("data-conversation-dialog")
        ) ??
        dialogs[0] ??
        null
      )
    }
    const focusables = (keepDisabledSelection = false) => {
      const dialog = modal()
      return [
        ...(dialog ?? root).querySelectorAll<HTMLElement>(
          dialog
            ? "button"
            : root.querySelector(".target-dim")
              ? ".target-cancel, .formation .card .hit"
              : SELECTOR
        ),
        // 保存の復旧は、開いている窓や対象選択を閉じなくても操作できる。
        ...root.querySelectorAll<HTMLElement>("[data-save-retry]"),
      ].filter((el) =>
        alive(
          el,
          keepDisabledSelection &&
            el === active &&
            el.hasAttribute("data-nav-button")
        )
      )
    }
    const mark = (el: HTMLElement | null) => {
      for (const entry of root.querySelectorAll(".is-active"))
        entry.classList.remove("is-active")
      active = el
      activeList = el?.closest<HTMLElement>(".listview") ?? null
      if (!el) return
      el.classList.add("is-active")
      el.closest(".card")?.classList.add("is-active")
      if (
        (el.hasAttribute("data-foe-pick") ||
          el.hasAttribute("data-nav-button")) &&
        document.activeElement !== el
      )
        el.focus({ preventScroll: true })
      const box = el.closest(".grid.rows, [data-gamepad-scroll]")
      if (box) {
        const header = box.querySelector<HTMLElement>(
          "[data-gamepad-scroll-header]"
        )
        if (header?.contains(el)) return
        const r = el.getBoundingClientRect()
        const b = box.getBoundingClientRect()
        const top = Math.max(
          b.top,
          header?.getBoundingClientRect().bottom ?? b.top
        )
        // 狭い説明欄でもボタンが収まる余白にし、再フォーカスで逆へ動かさない。
        const inset = Math.min(16, Math.max(0, (b.bottom - top - r.height) / 2))
        const behavior = box.hasAttribute("data-gamepad-scroll")
          ? "instant"
          : "smooth"
        if (r.top < top + inset)
          box.scrollBy({ top: r.top - top - inset, behavior })
        else if (r.bottom > b.bottom - inset)
          box.scrollBy({ top: r.bottom - b.bottom + inset, behavior })
      }
    }
    const fallback = () => {
      const list = focusables()
      // 売却などで操作が消えても、残りの行がある一覧から「戻る」へ決定を流さない。
      const rows = list.filter(
        (el) => activeList?.contains(el) && el.matches(".row")
      )
      return (
        list.find((el) => el.classList.contains("cta")) ??
        rows.find((el) => el.getAttribute("aria-pressed") === "true") ??
        rows[0] ??
        list.find((el) => el.classList.contains("word")) ??
        (modal() || root.querySelector(".target-dim") ? list[0] : null) ??
        null
      )
    }
    let queued = false
    const observer = new MutationObserver(() => {
      if (queued) return
      queued = true
      requestAnimationFrame(() => {
        queued = false
        // 再保存中の決定連打を背面へ送らない。方向操作で離れることはできる。
        if (
          active?.matches('[data-save-retry][aria-busy="true"]') &&
          root.contains(active) &&
          !active.closest("[inert]")
        )
          return
        // 在庫切れや上限到達で無効になった操作を保ち、決定連打を別の操作へ送らない。
        const available = focusables(true)
        if (!active || !available.includes(active)) {
          const focusedElement = document.activeElement
          mark(
            focusedElement instanceof HTMLElement &&
              available.includes(focusedElement)
              ? focusedElement
              : fallback()
          )
        }
      })
    })
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-leaving", "disabled", "inert"],
    })
    // スクロールだけで発生するpointeroverは、キー・パッドの選択を奪う。
    const pointerMoved = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return
      const target = (event.target as HTMLElement).closest<HTMLElement>(
        modal()
          ? "button"
          : ".word, .card, .dest, .map .node.pick, .slot-item, .tabbtn, .bagbtn, [data-route-choice], [data-loot-page], [data-foe-pick], [data-save-retry], [data-nav-button]"
      )
      if (!target) return
      const el = target.classList.contains("card")
        ? target.querySelector<HTMLElement>(".hit")
        : target
      if (el && el !== active) mark(el)
    }
    const focused = (event: FocusEvent) => {
      const element = event.target
      if (!(element instanceof HTMLElement)) return
      // 一覧そのものに入ったときも、パッドの決定先を選択中の札へ揃える。
      const target = element.matches(".revolver[data-own-enter]")
        ? element.querySelector<HTMLElement>('.dest[aria-selected="true"]')
        : element
      if (target && focusables().includes(target)) mark(target)
    }
    const navigate = (el: HTMLElement) => {
      mark(el)
      // 編集窓でパッドへ持ち替えたら、Enterも選んだボタンに届くようにする。
      // 開いた直後やマウス移動では、入力欄のフォーカスを奪わない。
      if (modal()?.contains(el) && document.activeElement !== el)
        el.focus({ preventScroll: true })
    }
    const move = (dx: number, dy: number) => {
      const candidates = focusables(true)
      const list = candidates.filter((el) => alive(el))
      if (!list.length) return
      if (!active || !candidates.includes(active))
        return navigate(fallback() ?? list[0])
      // 分岐の左右操作は札の並びを使い、背面の地図へ飛ばさない。
      if (dy === 0 && active.hasAttribute("data-route-choice")) {
        const choices = list.filter((element) =>
          element.hasAttribute("data-route-choice")
        )
        const next = choices[choices.indexOf(active) + Math.sign(dx)]
        if (next) navigate(next)
        return
      }
      if (dy > 0 && active.hasAttribute("data-route-choice")) {
        const survey = list.find((element) =>
          element.hasAttribute("data-route-survey")
        )
        if (survey) {
          navigate(survey)
          survey.focus({ preventScroll: true })
          return
        }
      }
      if (dy < 0 && active.hasAttribute("data-route-survey")) {
        const choice = list.find(
          (element) =>
            element.hasAttribute("data-route-choice") &&
            element.getAttribute("aria-pressed") === "true"
        )
        if (choice) {
          navigate(choice)
          choice.focus({ preventScroll: true })
          return
        }
      }
      const a = active.getBoundingClientRect()
      const ax = a.left + a.width / 2
      const ay = a.top + a.height / 2
      let best: HTMLElement | null = null
      let score = Infinity
      for (const el of list) {
        if (el === active) continue
        const r = el.getBoundingClientRect()
        const x = r.left + r.width / 2 - ax
        const y = r.top + r.height / 2 - ay
        const along = x * dx + y * dy
        if (along <= 4) continue
        const across = Math.abs(x * dy - y * dx)
        const s = along + across * 2.2
        if (s < score) {
          score = s
          best = el
        }
      }
      if (best) {
        navigate(best)
        play(best, [{ scale: "1.12" }, { scale: "1" }], {
          duration: 220,
          easing: "cubic-bezier(.34,1.56,.64,1)",
        })
      }
    }
    const cycle = (direction: -1 | 1) => {
      const list = focusables(true)
      let index = active ? list.indexOf(active) : -1
      if (index < 0) index = direction > 0 ? -1 : 0
      for (let step = 0; step < list.length; step++) {
        index = (index + direction + list.length) % list.length
        if (alive(list[index])) return navigate(list[index])
      }
    }
    const back = () => {
      const cancelTarget =
        root.querySelector<HTMLButtonElement>(".target-cancel")
      if (!modal() && cancelTarget && alive(cancelTarget)) {
        cancelTarget.click()
        return
      }
      if (modal()) {
        const close =
          modal()?.querySelector<HTMLElement>("[data-modal-close]") ??
          focusables().find((element) =>
            /^(‹|閉じる)/.test(
              element.getAttribute("aria-label") ??
                element.textContent?.trim() ??
                ""
            )
          )
        close?.click()
        return
      }
      // バッグを閉じる途中も、背後の場面の「戻る」へ取消を流さない。
      const bag = root.querySelector(".listview.bag")
      if (bag) {
        const close = bag.querySelector<HTMLElement>("[data-modal-close]")
        if (close && alive(close)) close.click()
        return
      }
      const target = focusables().find((el) =>
        /^(‹|撤退)/.test(
          el.getAttribute("aria-label") ?? el.textContent?.trim() ?? ""
        )
      )
      if (target) target.click()
      else root.querySelector<HTMLElement>(".close-layer")?.click()
    }
    const revolverOpen = () =>
      root.querySelector(".target-dim")
        ? null
        : [
            ...(modal() ?? root).querySelectorAll<HTMLElement>(".revolver"),
          ].find((el) => alive(el))
    const key = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (event.defaultPrevented) return
      // 文字を入れている間のキーは入力に使う（Backspace で戻る・a で左へ、などにしない）
      if (typingInto(event.target)) return
      const k = event.key
      if (k === "Tab" && !modal() && root.querySelector(".target-dim")) {
        const list = focusables()
        if (!list.length) return
        event.preventDefault()
        const focused = document.activeElement
        const index = list.indexOf(
          focused instanceof HTMLElement ? focused : (active ?? list[0])
        )
        const next =
          list[
            index < 0
              ? event.shiftKey
                ? list.length - 1
                : 0
              : (index + (event.shiftKey ? -1 : 1) + list.length) % list.length
          ]
        mark(next)
        next.focus()
        return
      }
      const n = Number(k)
      if (!modal() && n >= 1 && n <= 4)
        root
          .querySelectorAll<HTMLElement>(".formation .card .hit")
          [n - 1]?.click()
      if (
        (k === "ArrowUp" || k === "w" || k === "ArrowDown" || k === "s") &&
        revolverOpen()
      )
        return
      const direction = {
        ArrowLeft: [-1, 0],
        a: [-1, 0],
        ArrowRight: [1, 0],
        d: [1, 0],
        ArrowUp: [0, -1],
        w: [0, -1],
        ArrowDown: [0, 1],
        s: [0, 1],
      }[k]
      if (direction) {
        event.preventDefault()
        move(direction[0], direction[1])
      }
      const pressable = active && focusables().includes(active)
      if ((k === "Enter" || k === " ") && pressable) {
        event.preventDefault()
        active?.click()
      }
      if (k === "Escape" || k === "Backspace") {
        event.preventDefault()
        back()
      }
    }
    const previous: Record<number, Record<string, boolean>> = {}
    let frame = 0
    let previousPollTime: number | null = null
    const poll = (time: number) => {
      const elapsed =
        previousPollTime === null
          ? 0
          : Math.min(50, Math.max(0, time - previousPollTime))
      previousPollTime = time
      for (const pad of navigator.getGamepads?.() ?? []) {
        if (!pad) continue
        const scrollAxis = pad.axes[3] ?? 0
        if (
          Number.isFinite(scrollAxis) &&
          Math.abs(scrollAxis) > GAMEPAD_SCROLL_DEADZONE
        ) {
          const scope = modal() ?? root
          const area = scope.matches("[data-gamepad-scroll]")
            ? scope
            : scope.querySelector<HTMLElement>("[data-gamepad-scroll]")
          if (area && alive(area)) {
            const strength = Math.min(
              1,
              (Math.abs(scrollAxis) - GAMEPAD_SCROLL_DEADZONE) /
                (1 - GAMEPAD_SCROLL_DEADZONE)
            )
            area.scrollTop +=
              (Math.sign(scrollAxis) *
                strength *
                GAMEPAD_SCROLL_PIXELS_PER_SECOND *
                elapsed) /
              1000
          }
        }
        const b = (i: number) => !!pad.buttons[i]?.pressed
        const now = {
          up: b(12) || pad.axes[1] < -0.6,
          down: b(13) || pad.axes[1] > 0.6,
          left: b(14) || pad.axes[0] < -0.6,
          right: b(15) || pad.axes[0] > 0.6,
          ok: b(0),
          back: b(1),
          previous: b(4),
          next: b(5),
        }
        const prev = previous[pad.index] ?? {}
        const edge = (name: keyof typeof now) => now[name] && !prev[name]
        const send = (keyName: string) =>
          dispatchEvent(
            new KeyboardEvent("keydown", { key: keyName, cancelable: true })
          )
        if (edge("up")) {
          if (revolverOpen()) send("ArrowUp")
          else move(0, -1)
        }
        if (edge("down")) {
          if (revolverOpen()) send("ArrowDown")
          else move(0, 1)
        }
        if (edge("left")) move(-1, 0)
        if (edge("right")) move(1, 0)
        if (edge("previous")) cycle(-1)
        if (edge("next")) cycle(1)
        if (edge("ok")) {
          if (active && focusables().includes(active)) {
            const owner = active.closest<HTMLElement>(
              ".revolver[data-own-enter]"
            )
            if (owner)
              owner.dispatchEvent(
                new KeyboardEvent("keydown", {
                  key: "Enter",
                  cancelable: true,
                  bubbles: true,
                })
              )
            else active.click()
          }
        }
        if (edge("back")) back()
        previous[pad.index] = now
      }
      frame = requestAnimationFrame(poll)
    }
    frame = requestAnimationFrame(poll)
    document.addEventListener("pointermove", pointerMoved)
    document.addEventListener("focusin", focused)
    addEventListener("keydown", key)
    return () => {
      observer.disconnect()
      document.removeEventListener("pointermove", pointerMoved)
      document.removeEventListener("focusin", focused)
      removeEventListener("keydown", key)
      cancelAnimationFrame(frame)
    }
  }, [view])
}

/** ブラウザ標準のキー操作を使う入力・選択欄か（チェック欄やボタンは含めない）。 */
function typingInto(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (
    target.isContentEditable ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  )
    return true
  if (!(target instanceof HTMLInputElement)) return false
  return !["checkbox", "radio", "button", "submit", "reset", "range"].includes(
    target.type
  )
}
