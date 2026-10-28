import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"
import { characterGroups } from "@/concept/characters"

/** 秘密の部屋の一覧に出す悪魔の名前（設定データの名前）。 */
const listedName = (id: string, fallback: string) =>
  characterGroups
    .flatMap((group) => group.characters)
    .find((character) => character.id === id)?.name ?? fallback
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
            scene: "secret-demons",
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
      await runtime.advance(9000)
      const game = runtime.game!
      const save = game.save()
      const issue = game.restore({
        ...save,
        snapshot: {
          ...save.snapshot,
          demons: save.snapshot.demons.map((demon) => ({
            ...demon,
            lv: 20,
            exp: 0,
          })),
        },
      })
      if (issue) throw issue
      await runtime.advance(9001)
      const demon = game.queries
        .demons(game.state)
        .find((demon) => demon.fusion?.resist.some((entry) => entry.immune))!
      if (!demon) throw new Error("無効の悪魔がない")
      return {
        id: demon.id,
        name: demon.name,
        label: demon.fusion!.resist.find((entry) => entry.immune)!.label,
        save: JSON.stringify(game.save()),
      }
    })
    // 合体の効果は「合体する」の札から悪魔を選んだ詳細で見る
    await page
      .getByRole("button", { name: "合体する", exact: true })
      .first()
      .click()
    await page
      .getByRole("button", {
        name: listedName(expected.id, expected.name),
        exact: true,
      })
      .click()
    await page.evaluate(async () => {
      await window.__devStudio!.advance(11000)
    })
    const label = page.getByText(new RegExp(expected.label)).last()
    await label.waitFor({ state: "visible" })
    const bounds = await label.boundingBox()
    if (
      !bounds ||
      bounds.x < 0 ||
      bounds.x + bounds.width > viewport.width ||
      bounds.y < 0 ||
      bounds.y + bounds.height > viewport.height
    )
      throw new Error("合体の効果が画面外")
    const visible = await label.evaluate((element, text) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
      let node: Node | null
      while ((node = walker.nextNode())) {
        const offset = node.textContent!.indexOf(text)
        if (offset < 0) continue
        const range = document.createRange()
        range.setStart(node, offset)
        range.setEnd(node, offset + text.length)
        const bounds = range.getBoundingClientRect()
        const detail = element.closest('[role="region"]')!
        const viewport = detail.getBoundingClientRect()
        return bounds.top >= viewport.top && bounds.bottom <= viewport.bottom
      }
      return false
    }, expected.label)
    if (!visible) {
      await page.screenshot({ path: "/tmp/dnd-secret-immunity-clipped.png" })
      throw new Error("無効の文字が詳細の表示範囲外")
    }
    await page.screenshot({
      path: `/tmp/dnd-secret-immunity-${viewport.name}.png`,
    })
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== expected.save
    )
      throw new Error("閲覧で保存が変わる")
    console.log(`${viewport.name}: 合体の無効表示・保存保持`)
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
