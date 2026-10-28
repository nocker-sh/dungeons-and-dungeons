import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"
import { frameOf } from "@/content/looks/frame-of"

type TestPad = {
  index: number
  buttons: { pressed: boolean }[]
  axes: number[]
}
const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280]) {
    const page = await openPage(browser, { width, height: 844 }, errors)
    await page.routeWebSocket("**/*", () => {})
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "town",
            width,
            height: 844,
            duration: 60000,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    let time = 3500
    const advance = async (ms = 1200) => {
      time += ms
      await page.evaluate(
        async (time) => window.__devStudio!.advance(time),
        time
      )
    }
    await advance()
    const initial = await page.evaluate(() => {
      const game = (window.__devStudio as StudioRuntime).game!
      const hero = game.queries.hero(game.state)
      const pad: TestPad = {
        index: 0,
        buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
        axes: [0, 0, 0, 0],
      }
      Object.assign(window, { heroEditPad: pad })
      Object.defineProperty(navigator, "getGamepads", {
        configurable: true,
        value: () => [pad],
      })
      return {
        save: game.save(),
        look: hero.looks.find((entry) => !entry.chosen)!.id,
        lookIndex: hero.looks.findIndex((entry) => !entry.chosen),
        outfit: hero.outfits.at(-1)!.id,
      }
    })
    const save = () =>
      page.evaluate(() => (window.__devStudio as StudioRuntime).game!.save())
    const input = async (button: number) => {
      for (const pressed of [true, false]) {
        await page.evaluate(
          ({ button, pressed }) => {
            ;(
              window as unknown as { heroEditPad: TestPad }
            ).heroEditPad.buttons[button]!.pressed = pressed
          },
          { button, pressed }
        )
        await advance(250)
      }
    }
    await page.locator(".formation .card .hit").first().click()
    await advance()
    const open = async (name: string) => {
      await page.getByRole("button", { name, exact: true }).click()
      await advance()
    }
    const rename = page.getByRole("dialog", {
      name: "名前を変える",
      exact: true,
    })
    const name = rename.getByRole("textbox", {
      name: "名前（カタカナ）",
      exact: true,
    })
    await open("改名")
    assert.ok(await name.evaluate((el) => el === document.activeElement))
    for (const key of ["Tab", "Shift+Tab"]) {
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press(key)
        assert.ok(
          await rename.evaluate((el) => el.contains(document.activeElement))
        )
      }
    }
    await name.fill("ノア")
    await page.keyboard.press("Home")
    await page.keyboard.press("ArrowRight")
    await page.keyboard.press("Backspace")
    assert.equal(await name.inputValue(), "ア")
    assert.equal(await rename.count(), 1)
    await name.dispatchEvent("compositionstart")
    await name.fill("のあ")
    await name.dispatchEvent("keydown", { key: "Escape", isComposing: false })
    assert.equal(await rename.count(), 1, "変換中のEscは名前編集を閉じない")
    await name.dispatchEvent("keydown", {
      key: "Enter",
      keyCode: 229,
      isComposing: true,
    })
    await name.dispatchEvent("compositionend", { data: "のあ" })
    assert.equal(await name.inputValue(), "ノア")
    await name.dispatchEvent("keydown", {
      key: "Enter",
      keyCode: 229,
      isComposing: false,
    })
    assert.deepEqual(await save(), initial.save)
    await page.keyboard.press("Escape")
    await advance()
    assert.equal(await rename.count(), 0)
    assert.equal(await page.locator(".close-layer").count(), 1)
    assert.deepEqual(await save(), initial.save)
    for (const [next, previous] of [
      [5, 4],
      [15, 14],
    ]) {
      await open("改名")
      await name.fill("ノア")
      // 入力欄からパッドへ切り替え、その選択をEnterで決定しても同じ操作になる。
      await input(next)
      await input(previous)
      const cancelRename = rename.getByRole("button", {
        name: "やめる",
        exact: true,
      })
      assert.ok(
        await cancelRename.evaluate((el) => el.classList.contains("is-active"))
      )
      const cancelFocused = await cancelRename.evaluate(
        (el) => el === document.activeElement
      )
      await page.keyboard.press("Enter")
      await advance()
      assert.equal(await rename.count(), 0)
      assert.deepEqual(
        await save(),
        initial.save,
        "取消を選んだのに名前が変わった"
      )
      assert.ok(
        cancelFocused,
        "パッドで取消を選んでも、文字入力欄にフォーカスが残っている"
      )
    }
    await open("改名")
    await name.fill("")
    await page.keyboard.press("Enter")
    assert.equal(await rename.count(), 1)
    assert.deepEqual(await save(), initial.save)
    await name.fill("ミナ")
    await page.keyboard.press("Enter")
    await advance()
    const renamed = {
      ...initial.save,
      snapshot: {
        ...initial.save.snapshot,
        hero: { ...initial.save.snapshot.hero, name: "ミナ" },
      },
    }
    assert.deepEqual(await save(), renamed)
    await open("改名")
    await name.fill("ノア")
    await input(1)
    await advance()
    assert.equal(await rename.count(), 0)
    assert.equal(await page.locator(".close-layer").count(), 1)
    assert.deepEqual(await save(), renamed)

    const appearance = page.getByRole("dialog", {
      name: "容姿を変える",
      exact: true,
    })
    const outfit = appearance.getByRole("combobox", { name: "主人公の衣装" })
    const portrait = page.locator(".formation .card img").first()
    const originalPortrait = await portrait.getAttribute("src")
    await open("容姿")
    assert.ok(
      await appearance.evaluate((el) => el.contains(document.activeElement))
    )
    const controls = await appearance.locator("button, select").count()
    for (const key of ["Tab", "Shift+Tab"]) {
      for (let i = 0; i < controls + 2; i++) {
        await page.keyboard.press(key)
        assert.ok(
          await appearance.evaluate((el) => el.contains(document.activeElement))
        )
      }
    }
    await outfit.focus()
    // 標準selectのキーをゲーム側で取り消さず、背後の札も選ばない。
    await page.evaluate(() => {
      Object.assign(window, { heroEditKeys: [] })
      window.addEventListener("keydown", (event) => {
        if (event.target instanceof HTMLSelectElement) {
          ;(window as unknown as { heroEditKeys: boolean[] }).heroEditKeys.push(
            event.defaultPrevented
          )
        }
      })
    })
    for (const key of ["ArrowDown", "ArrowUp", "Home", "End"])
      await page.keyboard.press(key)
    assert.deepEqual(
      await page.evaluate(
        () => (window as unknown as { heroEditKeys: boolean[] }).heroEditKeys
      ),
      [false, false, false, false]
    )
    assert.ok(await outfit.evaluate((el) => el === document.activeElement))
    assert.equal(await page.locator(".formation .is-active").count(), 0)
    // OS側の選択メニューはPlaywrightの標準操作で選び、実際の草案と保存を検証する。
    await outfit.selectOption(initial.outfit)
    assert.equal(await outfit.inputValue(), initial.outfit)
    const photo = appearance
      .locator("button[aria-pressed]")
      .nth(initial.lookIndex)
    await photo.focus()
    await input(0)
    assert.equal(await photo.getAttribute("aria-pressed"), "true")
    assert.deepEqual(await save(), renamed)
    await page.keyboard.press("Escape")
    await advance()
    assert.equal(await appearance.count(), 0)
    assert.equal(await page.locator(".close-layer").count(), 1)
    assert.deepEqual(await save(), renamed)
    await open("容姿")
    await outfit.selectOption(initial.outfit)
    await photo.focus()
    await input(0)
    await page.screenshot({ path: `/tmp/dnd-hero-editing-${width}.png` })
    await appearance
      .getByRole("button", { name: "この容姿にする", exact: true })
      .focus()
    await page.keyboard.press("Enter")
    await advance()
    const changed = {
      ...renamed,
      snapshot: {
        ...renamed.snapshot,
        hero: {
          ...renamed.snapshot.hero,
          look: initial.look,
          outfit: initial.outfit,
        },
      },
    }
    assert.deepEqual(await save(), changed)
    assert.equal(
      await portrait.getAttribute("src"),
      frameOf(initial.look, initial.outfit).img,
      "保存した容姿・衣装を隊列の立ち絵へ反映する"
    )
    assert.notEqual(await portrait.getAttribute("src"), originalPortrait)
    assert.ok(
      await portrait.evaluate(
        (image) =>
          (image as HTMLImageElement).complete &&
          (image as HTMLImageElement).naturalWidth > 0
      )
    )
    await open("容姿")
    await input(1)
    await advance()
    assert.equal(await appearance.count(), 0)
    assert.equal(await page.locator(".close-layer").count(), 1)
    assert.deepEqual(await save(), changed)
    console.log(
      `${width}: 改名・容姿のTab循環、IME・文字削除、標準selectのキー保持、パッド選択後のEnter、写真のパッド選択、取消と保存範囲 OK`
    )
    await page.close()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
