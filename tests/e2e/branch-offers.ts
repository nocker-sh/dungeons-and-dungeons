import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioBridge } from "@/client/dev/studio-types"
import type { StudioRuntime } from "@/client/dev/studio-runtime"

const browser = await launch()
const errors: string[] = []
try {
  for (const viewport of [
    { name: "small", width: 320, height: 760 },
    { name: "phone", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    const page = await openPage(browser, viewport, errors)
    page.setDefaultTimeout(15000)
    await page.goto(`${BASE_URL}/previews/route-chest-branch?still`)
    const sealed = page.locator('[data-route-choice="l10"]')
    const treasure = page.locator('[data-route-choice="n10"]')
    const details = page.getByRole("region", { name: "選んだ道の見通し" })
    async function checkSelectedPathTitle(button: typeof sealed) {
      const label = await button.locator("div").first().innerText()
      if (
        (await details.locator("[data-selected-path-name]").innerText()) !==
        `${label}の見通し`
      )
        throw new Error("見通しの道名が選んだ道と一致しない")
    }
    await sealed.click()
    await page.waitForTimeout(1700)
    await checkSelectedPathTitle(sealed)
    if (!(await details.textContent())?.includes("支払い：30G"))
      throw new Error("分岐に実際の支払いがない")
    if (!(await details.textContent())?.includes("スキルの書を1冊"))
      throw new Error("分岐に実際の報酬個数がない")
    await sealed.focus()
    await page.keyboard.press("Tab")
    if (
      !(await details.evaluate((element) => document.activeElement === element))
    )
      throw new Error("Tabで見通しへ進めない")
    await page.keyboard.press("End")
    if (!(await details.evaluate((element) => element.scrollTop > 0)))
      throw new Error("末尾へスクロールできない")
    await page.keyboard.press("Enter")
    if (await page.locator(".talkbox").count())
      throw new Error("見通しを読むEnterで出発した")
    await page.keyboard.press("Home")
    if ((await details.evaluate((element) => element.scrollTop)) !== 0)
      throw new Error("先頭へ戻れない")
    if (
      viewport.name === "small" &&
      (await details.evaluate((element) => element.clientHeight)) < 60
    )
      throw new Error("スマホの見通し欄が3行分より狭い")
    const bounds = await details.boundingBox()
    if (!bounds || bounds.x < 0 || bounds.x + bounds.width > viewport.width + 1)
      throw new Error("見通しが画面からはみ出す")
    const carryingBounds = await page.getByRole("status").boundingBox()
    if (carryingBounds && bounds.y + bounds.height > carryingBounds.y - 4)
      throw new Error("見通しと戦利品が重なっている")
    await page.mouse.move(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2
    )
    await page.mouse.wheel(0, 200)
    await page.waitForTimeout(150)
    if (!(await details.evaluate((element) => element.scrollTop > 0)))
      throw new Error("ホイールで見通しを読めない")
    await sealed.focus()
    await page.keyboard.press("ArrowLeft")
    await page.keyboard.press("Enter")
    if ((await treasure.getAttribute("aria-pressed")) !== "true")
      throw new Error("左キーとEnterで別の道を選べない")
    if ((await details.evaluate((element) => element.scrollTop)) !== 0)
      throw new Error("道を変えても見通しが先頭へ戻らない")
    await checkSelectedPathTitle(treasure)
    await page.keyboard.press("ArrowRight")
    await page.keyboard.press("Enter")
    if ((await sealed.getAttribute("aria-pressed")) !== "true")
      throw new Error("右キーとEnterで封印箱へ戻れない")
    await checkSelectedPathTitle(sealed)
    await page.evaluate(() => {
      const pad = {
        index: 0,
        buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
        axes: [0, 0, 0, 0],
      }
      Object.assign(window, { branchTestPad: pad })
      Object.defineProperty(navigator, "getGamepads", {
        configurable: true,
        value: () => [pad],
      })
    })
    async function press(index: number) {
      for (const pressed of [true, false]) {
        await page.evaluate(
          ({ index, pressed }) => {
            const pad = (
              window as unknown as {
                branchTestPad: { buttons: { pressed: boolean }[] }
              }
            ).branchTestPad
            pad.buttons[index].pressed = pressed
          },
          { index, pressed }
        )
        await page.waitForTimeout(120)
      }
    }
    await sealed.focus()
    await press(14)
    await press(0)
    if ((await treasure.getAttribute("aria-pressed")) !== "true")
      throw new Error("コントローラーで道を選べない")
    await press(15)
    await press(0)
    if ((await sealed.getAttribute("aria-pressed")) !== "true")
      throw new Error("コントローラーで封印箱へ戻れない")
    async function scrollStick(value: number, duration = 500) {
      await page.evaluate((value) => {
        const pad = (window as unknown as { branchTestPad: { axes: number[] } })
          .branchTestPad
        pad.axes[3] = value
      }, value)
      await page.waitForTimeout(duration)
      await page.evaluate(() => {
        const pad = (window as unknown as { branchTestPad: { axes: number[] } })
          .branchTestPad
        pad.axes[3] = 0
      })
      await page.waitForTimeout(100)
    }
    await details.focus()
    await page.keyboard.press("Home")
    await sealed.focus()
    await scrollStick(0.1, 200)
    if ((await details.evaluate((element) => element.scrollTop)) !== 0)
      throw new Error("右スティックの小さな揺れでスクロールした")
    await scrollStick(0.9)
    if (!(await details.evaluate((element) => element.scrollTop > 0)))
      throw new Error("右スティックで見通しを下へ読めない")
    await scrollStick(-0.9)
    if ((await details.evaluate((element) => element.scrollTop)) !== 0)
      throw new Error("右スティックで見通しの先頭へ戻れない")
    if ((await sealed.getAttribute("aria-pressed")) !== "true")
      throw new Error("読む操作で道の選択が変わった")
    if (await page.locator(".talkbox").count())
      throw new Error("道を選ぶ操作だけで出発した")
    if (
      !(await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1
      ))
    )
      throw new Error("横スクロールが発生した")
    await page.screenshot({
      path: `/tmp/dnd-branch-offers-${viewport.name}.png`,
    })
    await page.getByRole("button", { name: "進む", exact: true }).click()
    await page
      .getByRole("button", { name: "会話を進める", exact: true })
      .waitFor()
    const beforeConversationScroll = await details.evaluate(
      (element) => element.scrollTop
    )
    await scrollStick(0.9)
    if (
      (await details.evaluate((element) => element.scrollTop)) !==
      beforeConversationScroll
    )
      throw new Error("会話中に右スティックが背面の見通しを動かした")
    console.log(
      `${viewport.name}: 金額・報酬個数・Tab・スクロール・キー/コントローラー選択・横はみ出しを確認`
    )
    await page.close()

    for (const alive of [true, false]) {
      const frame = await openPage(browser, viewport, errors)
      const config = parseStudioConfig({
        scene: "route-chest-branch",
        width: viewport.width,
        height: viewport.height,
        // 交渉役（アルマ）を出撃の3人目に置く
        party: ["hero", "alda", "alma"],
        hp: [100, 100, 100],
      })
      await frame.goto(BASE_URL + frameUrl(config))
      await frame.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      await frame.evaluate(async () => {
        await window.__devStudio!.advance(2000)
      })
      if (!alive) {
        await frame.evaluate(async () => {
          const runtime = window.__devStudio as StudioRuntime
          const game = runtime.game!
          const saved = game.save()
          const negotiator = game.state.party[2]
          const problem = game.restore({
            ...saved,
            snapshot: {
              ...saved.snapshot,
              members: saved.snapshot.members.map((member) =>
                member.id === negotiator ? { ...member, hp: 0 } : member
              ),
            },
          })
          if (problem) throw new Error(String(problem))
          await runtime.advance(2400)
        })
      }
      await frame.locator('[data-route-choice="l10"]').click()
      const region = frame.getByRole("region", { name: "選んだ道の見通し" })
      const price = alive ? 26 : 30
      if (!(await region.textContent())?.includes(`支払い：${price}G`))
        throw new Error(`交渉役${alive ? "生存" : "戦闘不能"}時の金額が不一致`)
      const inspection = await frame.evaluate(() =>
        (window.__devStudio as StudioBridge).inspect()
      )
      if (inspection.errors.length)
        throw new Error(inspection.errors.join("\n"))
      console.log(
        `${viewport.name}: 交渉役${alive ? "生存26G" : "戦闘不能30G"}の表示を確認`
      )
      await frame.close()
    }
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
