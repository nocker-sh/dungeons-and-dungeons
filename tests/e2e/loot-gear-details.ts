import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
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
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "route-loot-rare",
            duration: 15000,
            width: viewport.width,
            height: viewport.height,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    const expected = await page.evaluate(async () => {
      const runtime = window.__devStudio as StudioRuntime
      await runtime.advance(3500)
      const game = runtime.game!
      const gear = game.queries
        .gear(game.state)
        .find((entry) => entry.gear === "preview-drop")!
      if (!gear?.weapon?.skills.length) throw new Error("展示武器のワザがない")
      return {
        name: `${gear.rarity} ${gear.name}`,
        skills: gear.weapon.skills.map(
          (skill) =>
            `${skill.random ? "＊" : ""}${skill.name}（${skill.uses ?? 0}回）`
        ),
        stat: gear.stat,
        save: JSON.stringify(game.save()),
      }
    })
    const trigger = page.getByRole("button", {
      name: `${expected.name} ×1`,
      exact: true,
    })
    await trigger.click()
    await page.evaluate(async () => {
      await (window.__devStudio as StudioRuntime).advance(4000)
    })
    const dialog = page.getByRole("dialog", {
      name: `${expected.name}の詳細`,
      exact: true,
    })
    await dialog.waitFor()
    await page.waitForTimeout(450)
    const text = await dialog.innerText()
    for (const expectedText of [
      ...expected.skills,
      expected.stat,
      "装備の変更は街でできます。",
    ]) {
      if (!text.includes(expectedText))
        throw new Error(`詳細にない：${expectedText}`)
    }
    const readable = await dialog.evaluate((element) => {
      const description = Array.from(element.querySelectorAll("span")).find(
        (span) =>
          span.childElementCount === 0 &&
          span.textContent?.includes("装備の変更は街でできます。")
      )!
      const bounds = description.getBoundingClientRect()
      return {
        size: Number.parseFloat(getComputedStyle(description).fontSize),
        fits:
          bounds.left >= 0 &&
          bounds.right <= innerWidth &&
          bounds.top >= 0 &&
          bounds.bottom <= innerHeight,
      }
    })
    if (readable.size < 12 || !readable.fits)
      throw new Error(`詳細が読めない：${JSON.stringify(readable)}`)
    await page.screenshot({
      path: `/tmp/dnd-loot-gear-details-${viewport.name}.png`,
    })
    await dialog
      .getByRole("button", {
        name: `${expected.name}の詳細を閉じる`,
        exact: true,
      })
      .click()
    await page.evaluate(async () => {
      await (window.__devStudio as StudioRuntime).advance(4500)
    })
    await dialog.waitFor({ state: "detached" })
    const after = await page.evaluate(() =>
      JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
    )
    if (after !== expected.save) throw new Error("詳細の開閉で保存状態が変化")
    console.log(
      `${viewport.name}: 入手武器の全ワザ・性能・街の案内・欄内表示・保存保持を確認`
    )
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
