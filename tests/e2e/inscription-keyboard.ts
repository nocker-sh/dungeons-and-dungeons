import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import goods from "@/content/data/goods.json"
import shops from "@/content/data/shops.json"
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
            scene: "smithy-repair",
            duration: 15000,
            width: viewport.width,
            height: viewport.height,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    const expected = await page.evaluate(
      async ({ sword, shop }) => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(2500)
        const game = runtime.game!
        const saved = game.save()
        const issue = game.restore({
          ...saved,
          snapshot: { ...saved.snapshot, gold: 100000 },
        })
        if (issue) throw issue
        for (let index = 0; index < 2; index++)
          if (!Array.isArray(game.send({ type: "buy", shop, good: sword })))
            throw new Error("購入失敗")
        const bought = game.save()
        const upgradedId = bought.snapshot.gear.at(-1)!.id
        const upgraded = game.restore({
          ...bought,
          snapshot: {
            ...bought.snapshot,
            gear: bought.snapshot.gear.map((entry) =>
              entry.id === upgradedId ? { ...entry, plus: 3 } : entry
            ),
          },
        })
        if (upgraded) throw upgraded
        await runtime.advance(3500)
        const upgradedWeapon = game.queries
          .smithy(game.state)!
          .inscriptions.find((entry) => entry.gear === upgradedId)!
        return {
          upgradedName: upgradedWeapon.name,
          upgradedGroup: `${upgradedWeapon.name}・レア度${upgradedWeapon.rarity}・未装備`,
          names: game.queries
            .smithy(game.state)!
            .inscriptions.filter(
              (entry) =>
                game.state.gear.find((gear) => gear.id === entry.gear)?.good ===
                sword
            )
            .map((entry) => entry.name),
          save: JSON.stringify(game.save()),
        }
      },
      {
        sword: goods.find((entry) => entry.slug === "sword")!.id,
        shop: shops.find((entry) => entry.slug === "armory")!.id,
      }
    )
    await page.getByRole("button", { name: /ワザの付け替え/ }).click()
    const dialog = page.getByRole("dialog", { name: "ワザの付け替え" })
    const buttons = dialog.getByRole("button")
    await buttons.first().waitFor({ state: "visible" })
    if (
      !(await buttons
        .first()
        .evaluate((element) => element === document.activeElement))
    )
      throw new Error("最初の操作にフォーカスがない")
    await page.keyboard.press("Shift+Tab")
    if (
      !(await buttons
        .last()
        .evaluate((element) => element === document.activeElement))
    )
      throw new Error("逆Tabが画面外へ出る")
    await page.keyboard.press("Tab")
    if (
      !(await buttons
        .first()
        .evaluate((element) => element === document.activeElement))
    )
      throw new Error("Tabが画面外へ出る")
    for (const name of expected.names)
      if (!(await dialog.innerText()).includes(name))
        throw new Error("武器名が欠ける")
    const row = dialog.getByRole("group", {
      name: expected.upgradedGroup,
      exact: true,
    })
    await row.getByRole("button").first().click()
    if (!(await dialog.innerText()).includes(`${expected.upgradedName}：`))
      throw new Error("選択した強化武器が違う")
    await page.screenshot({
      path: `/tmp/dnd-inscription-plus-${viewport.name}.png`,
    })
    await page.evaluate(() => {
      const pad = {
        index: 0,
        buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
        axes: [0, 0, 0, 0],
      }
      Object.assign(window, { inscriptionTestPad: pad })
      Object.defineProperty(navigator, "getGamepads", {
        configurable: true,
        value: () => [pad],
      })
    })
    let time = 4000
    const padB = async (pressed: boolean) => {
      await page.evaluate((pressed) => {
        ;(
          window as unknown as {
            inscriptionTestPad: { buttons: { pressed: boolean }[] }
          }
        ).inscriptionTestPad.buttons[1]!.pressed = pressed
      }, pressed)
      time += 500
      await page.evaluate(
        async (time) => window.__devStudio!.advance(time),
        time
      )
    }
    await padB(true)
    if (!(await dialog.isVisible()))
      throw new Error("パッドBで武器選びへ戻らず画面ごと閉じた")
    if (
      !(await dialog.innerText()).includes(`${expected.upgradedName}（未装備）`)
    )
      throw new Error("パッドBで武器一覧に戻れない")
    await padB(false)
    await row.getByRole("button").first().click()
    await page.keyboard.press("Escape")
    if (
      !(await dialog.innerText()).includes(`${expected.upgradedName}（未装備）`)
    )
      throw new Error("Escapeで武器一覧に戻れない")
    await row.getByRole("button").first().click()
    await page.keyboard.press("Backspace")
    if (
      !(await dialog.innerText()).includes(`${expected.upgradedName}（未装備）`)
    )
      throw new Error("Backspaceで武器一覧に戻れない")
    await page.keyboard.press("Escape")
    if (await dialog.count()) throw new Error("Escapeで閉じられない")
    await page.getByRole("button", { name: /ワザの付け替え/ }).click()
    await page.keyboard.press("Backspace")
    if (await dialog.count()) throw new Error("Backspaceで閉じられない")
    await page.getByRole("button", { name: /ワザの付け替え/ }).click()
    await padB(true)
    if (await dialog.count()) throw new Error("パッドBで一覧を閉じられない")
    await padB(false)
    await page.waitForFunction(() =>
      document.activeElement?.matches("[data-inscription-trigger]")
    )
    if (
      (await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )) !== expected.save
    )
      throw new Error("選択で保存が変わる")
    console.log(
      `${viewport.name}: Escape/Backspace/パッドBで選択取消・閉じる・保存保持`
    )
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
