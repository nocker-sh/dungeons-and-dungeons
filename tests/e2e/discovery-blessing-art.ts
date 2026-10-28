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
    for (const choice of ["book", "blessing"]) {
      const page = await openPage(browser, viewport, errors)
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: "route-discovery",
              duration: 10000,
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
        await runtime.advance(2500)
        const game = runtime.game!
        const discovery = game.queries.route(game.state)!.discovery!
        if (discovery.title !== "渓谷の祝福")
          throw new Error("祝福の場面でない")
        const skill = discovery.choices.find((choice) => choice.blessings)
          ?.blessings?.[0]
        if (!skill) throw new Error("祝福の候補がない")
        const recipient = discovery.recipients[0]!
        return { skill, recipient, save: game.save() }
      })
      const dialog = page.getByRole("dialog", {
        name: "渓谷の祝福",
        exact: true,
      })
      const picture = dialog.getByRole("img", {
        name: "祝福を授ける石の祭壇と、その隣に置かれたスキルの書",
        exact: true,
      })
      await picture.waitFor()
      await page.waitForFunction(() => {
        const image = document.querySelector(
          'img[src="/tmp/scenes/discovery-blessing-fisheye-comic-v3.webp"]'
        ) as HTMLImageElement | null
        return image?.complete && image.naturalWidth === 1536
      })
      const bounds = await picture.boundingBox()
      if (
        !bounds ||
        bounds.width < 50 ||
        bounds.x < 0 ||
        bounds.x + bounds.width > viewport.width
      )
        throw new Error("祝福の絵が画面に収まらない")
      if (
        (await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )) !== JSON.stringify(expected.save)
      )
        throw new Error("画像表示で保存が変わる")
      await page.screenshot({
        path: `/tmp/dnd-discovery-blessing-${viewport.name}-${choice}.png`,
      })
      if (choice === "book")
        await dialog
          .getByRole("button", { name: /^スキルの書を持ち帰る/ })
          .click()
      else {
        await dialog
          .getByRole("button", {
            name: new RegExp(`^${expected.skill.name}・`),
          })
          .click()
        const summary = dialog.locator("[data-selected-blessing]")
        if (
          (await summary.innerText()) !==
          `${expected.skill.uses}回：${expected.skill.desc}`
        )
          throw new Error("仲間の選択中に祝福の効果と回数が見えない")
        if (
          (await page.evaluate(() =>
            JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
          )) !== JSON.stringify(expected.save)
        )
          throw new Error("仲間の選択前に祝福が確定した")
        await page.screenshot({
          path: `/tmp/dnd-discovery-blessing-${viewport.name}-recipient.png`,
        })
        await dialog
          .getByRole("button", {
            name: new RegExp(`^${expected.recipient.name}：`),
          })
          .click()
      }
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).advance(3500)
      )
      const after = await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      )
      if (after.snapshot.gold !== expected.save.snapshot.gold)
        throw new Error("無料の祝福で所持金が変わる")
      if (choice === "book") {
        const count = (state: typeof after) =>
          state.snapshot.bag.find(
            (entry) => entry.good === "49c06f75-74e8-4a31-a9bb-d6b09e96d001"
          )?.count ?? 0
        if (count(after) !== count(expected.save) + 1)
          throw new Error("スキルの書の報酬が違う")
      } else if (
        after.snapshot.members.find(
          (member) => member.id === expected.recipient.id
        )?.blessing !== expected.skill.id
      )
        throw new Error("選んだ仲間へ祝福が付かない")
      if (choice === "blessing") {
        await page.evaluate(async (saved) => {
          const runtime = window.__devStudio as StudioRuntime
          const problem = runtime.game!.restore(saved)
          if (problem) throw problem
          await runtime.advance(4500)
        }, expected.save)
        const book = dialog.getByRole("button", {
          name: /^スキルの書を持ち帰る/,
        })
        if ((await book.count()) !== 1)
          throw new Error("次の祝福イベントに前の仲間選択が残る")
        await book.click()
        await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).advance(5500)
        )
        const repeated = await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).game!.save()
        )
        const count = (state: typeof repeated) =>
          state.snapshot.bag.find(
            (entry) => entry.good === "49c06f75-74e8-4a31-a9bb-d6b09e96d001"
          )?.count ?? 0
        if (count(repeated) !== count(expected.save) + 1)
          throw new Error("再訪したイベントで書を選べない")
      }
      console.log(
        `${viewport.name}/${choice}: 専用画像・保存保持・選択の実際の効果${choice === "blessing" ? "・再訪時の選び直し" : ""}`
      )
      await page.close()
    }
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
