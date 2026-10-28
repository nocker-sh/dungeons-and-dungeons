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
    for (const encounter of [
      {
        station: "n3",
        title: "ククルスの露店",
        artwork: "tsunofood-stall",
        image: "/tmp/scenes/discovery-kukulus-stall-fisheye-comic-v3.webp",
      },
      {
        station: "m3",
        title: "魔物の交換屋",
        artwork: "discovery-monster-trade",
        image: "/tmp/scenes/discovery-monster-trade-fisheye-comic-v3.webp",
      },
    ]) {
      const page = await openPage(browser, viewport, errors)
      page.setDefaultTimeout(15000)
      console.log(`start: ${viewport.name} ${encounter.title}`)
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: "route-discovery",
              width: viewport.width,
              height: viewport.height,
            })
          )
      )
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      // Diagnostic setup only: use validated saves and actual event content, without altering rules.
      await page.evaluate(async (station) => {
        const runtime = window.__devStudio as StudioRuntime
        const game = runtime.game!
        const saved = game.save()
        if (saved.snapshot.phase.type !== "expedition")
          throw new Error("探索ではない")
        const problem = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            phase: {
              type: "expedition",
              expedition: {
                ...saved.snapshot.phase.expedition,
                at: station,
                visited: ["s", station],
                pending: { kind: "discovery" },
              },
            },
          },
        })
        if (problem) throw new Error(String(problem))
        await runtime.advance(2500)
      }, encounter.station)
      const dialog = page.getByRole("dialog", {
        name: encounter.title,
        exact: true,
      })
      await dialog.waitFor()
      await page.keyboard.press("1")
      await page.waitForTimeout(500)
      if (await page.locator(".stand").count())
        throw new Error("取引中に背面の仲間詳細が開いた")
      if ((await dialog.getAttribute("aria-modal")) !== "true")
        throw new Error("取引画面が操作の境界になっていない")
      const buttons = dialog.locator("button:not(:disabled)")
      const first = buttons.first()
      if (
        !(await first.evaluate((element) => element === document.activeElement))
      )
        throw new Error("最初の選択肢にフォーカスがない")
      await page.keyboard.press("Shift+Tab")
      if (
        !(await buttons
          .last()
          .evaluate((element) => element === document.activeElement))
      )
        throw new Error("逆Tabが取引画面から抜けた")
      await page.keyboard.press("Tab")
      if (
        !(await first.evaluate((element) => element === document.activeElement))
      )
        throw new Error("Tabが取引画面から抜けた")
      for (let index = 0; index < (await buttons.count()); index++)
        await page.keyboard.press("Tab")
      if (
        !(await first.evaluate((element) => element === document.activeElement))
      )
        throw new Error("Tabが一周しない")
      const outside = { x: 2, y: viewport.height - 2 }
      if (
        !(await page.evaluate(
          ({ x, y }) =>
            document
              .elementFromPoint(x, y)
              ?.hasAttribute("data-discovery-backdrop"),
          outside
        ))
      )
        throw new Error("背面の操作を覆う境界がない")
      await page.mouse.click(outside.x, outside.y)
      if (await page.locator(".stand").count())
        throw new Error("マウスで背面の仲間詳細が開いた")
      const picture = dialog.locator(`img[src="${encounter.image}"]`)
      await picture.scrollIntoViewIfNeeded()
      await picture.waitFor()
      if (
        !(await picture.evaluate(
          (image) =>
            (image as HTMLImageElement).complete &&
            (image as HTMLImageElement).naturalWidth > 0
        ))
      )
        throw new Error("絵を読み込めない")
      const bounds = await picture.boundingBox()
      if (
        !bounds ||
        bounds.width < 50 ||
        bounds.x < 0 ||
        bounds.x + bounds.width > viewport.width
      )
        throw new Error("絵が画面からはみ出す")
      await page.screenshot({
        path: `/tmp/dnd-${encounter.artwork}-${viewport.name}.png`,
      })
      const before = await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.state)
      )
      if (viewport.name === "desktop") {
        await page.evaluate(async () => {
          const pad = {
            index: 0,
            axes: [0, 0, 0, 0],
            buttons: Array.from({ length: 16 }, (_, index) => ({
              pressed: index === 1,
            })),
          }
          Object.defineProperty(navigator, "getGamepads", {
            configurable: true,
            value: () => [pad],
          })
          await window.__devStudio!.advance(4000)
          pad.buttons[1].pressed = false
        })
      } else if (viewport.name === "phone") {
        await page.keyboard.press("Escape")
      } else {
        await dialog
          .getByRole("button", { name: /買わずに進む|取引せずに進む/ })
          .click()
      }
      await page.evaluate(async () => {
        await window.__devStudio!.advance(4500)
      })
      const after = await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.state)
      )
      if (before === after || (await dialog.count()))
        throw new Error("選択を完了できない")
      console.log(`${viewport.name}: ${encounter.title}の画像と退出を確認`)
      await page.close()
    }
    const altar = await openPage(browser, viewport, errors)
    altar.setDefaultTimeout(15000)
    await altar.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "route-discovery",
            width: viewport.width,
            height: viewport.height,
          })
        )
    )
    await altar.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    await altar.evaluate(async () => {
      await window.__devStudio!.advance(2500)
    })
    await altar.evaluate(async () => {
      const runtime = window.__devStudio as StudioRuntime
      const game = runtime.game!
      const saved = game.save()
      const problem = game.restore({
        ...saved,
        snapshot: {
          ...saved.snapshot,
          members: saved.snapshot.members.map((member) =>
            member.id === saved.snapshot.party[0]
              ? { ...member, hp: 0 }
              : member
          ),
        },
      })
      if (problem) throw new Error(String(problem))
      await runtime.advance(2800)
    })
    const blessingDialog = altar.getByRole("dialog", {
      name: "渓谷の祝福",
      exact: true,
    })
    await blessingDialog.waitFor()
    const choice = blessingDialog.locator("button:not(:disabled)").first()
    await choice.click()
    const recipients = await altar.evaluate(() => {
      const game = (window.__devStudio as StudioRuntime).game!
      return game.queries.route(game.state)!.discovery!.recipients
    })
    for (const member of recipients) {
      const button = blessingDialog
        .getByRole("button")
        .filter({ hasText: `${member.name}：` })
      const text = await button.textContent()
      if (!text?.includes(`HP（生命力） ${member.hp}/${member.maxHp}`))
        throw new Error("相手のHP表示が一致しない")
      if (member.hp === 0 && !text.includes("戦闘不能（復活するまで使えない）"))
        throw new Error("戦闘不能が分からない")
    }
    await altar.screenshot({
      path: `/tmp/dnd-blessing-recipient-${viewport.name}.png`,
    })
    await blessingDialog
      .getByRole("button", { name: "選び直す", exact: true })
      .waitFor()
    await altar.keyboard.press("Escape")
    if (
      await blessingDialog
        .getByRole("button", { name: "選び直す", exact: true })
        .count()
    )
      throw new Error("Escで授ける仲間の選択から戻れない")
    await choice.click()
    await blessingDialog.locator("button:not(:disabled)").first().click()
    await altar.evaluate(async () => {
      await window.__devStudio!.advance(4500)
    })
    if (await blessingDialog.count())
      throw new Error("祝福を授けても選択が終わらない")
    if (
      !(await altar.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.state.members.some(
          (member) => !!member.blessing
        )
      ))
    )
      throw new Error("仲間に祝福が反映されていない")
    console.log(`${viewport.name}: 祝福の選び直しと授与を確認`)
    await altar.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
