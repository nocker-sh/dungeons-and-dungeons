import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"
import goods from "@/content/data/goods.json"

declare global {
  interface Window {
    __findsProbe: {
      armor: string[]
      weapon: string[]
      pad: { index: number; axes: number[]; buttons: { pressed: boolean }[] }
    }
  }
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
            scene: "outskirts-deep",
            width,
            height: 844,
            duration: 60000,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    const expected = await page.evaluate(
      async (weapon) => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(3500)
        const game = runtime.game!
        const saved = game.save()
        const problem = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            gear: [
              ...saved.snapshot.gear,
              ...Array.from({ length: 500 }, (_, index) => ({
                id: `finds-load-${index}`,
                good: weapon.id,
                owner: null,
                plus: 0,
                wear: 0,
                progress: 0,
                weapon: {
                  rarity: "N",
                  extraPower: 0,
                  skills: [...weapon.skills!],
                },
              })),
            ],
          },
        })
        if (problem) throw new Error(JSON.stringify(problem.cause))
        await runtime.advance(4000)
        const destination = game.queries
          .destinations(game.state)
          .find(
            (entry) => entry.id === game.queries.defaultDestination(game.state)
          )!
        window.__findsProbe = {
          armor: [],
          weapon: [],
          pad: {
            index: 0,
            axes: [0, 0, 0, 0],
            buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
          },
        }
        const armor = game.queries.armorGoalComparison.bind(game.queries)
        game.queries.armorGoalComparison = (...args) => {
          window.__findsProbe.armor.push(args[2])
          return armor(...args)
        }
        const fit = game.queries.weaponFit.bind(game.queries)
        game.queries.weaponFit = (...args) => {
          window.__findsProbe.weapon.push(args[2])
          return fit(...args)
        }
        Object.defineProperty(navigator, "getGamepads", {
          configurable: true,
          value: () => [window.__findsProbe.pad],
        })
        return {
          armor: destination.armorFinds[0].id,
          armorName: destination.armorFinds[0].name,
          save: game.save(),
        }
      },
      goods.find((entry) => entry.slug === "greatsword")!
    )
    let time = 4000
    const advance = async (ms = 250) => {
      time += ms
      await page.evaluate(
        (time) => (window.__devStudio as StudioRuntime).advance(time),
        time
      )
    }
    const pad = async (button: number) => {
      for (const pressed of [true, false]) {
        await page.evaluate(
          ({ button, pressed }) => {
            window.__findsProbe.pad.buttons[button]!.pressed = pressed
          },
          { button, pressed }
        )
        await advance()
      }
    }
    const trigger = page.getByRole("button", {
      name: "探索装備の目標を見る",
      exact: true,
    })
    await page.locator('.revolver .dest[aria-selected="true"]').focus()
    for (let step = 0; step < 20; step++) {
      await pad(5)
      if (
        await trigger.evaluate((node) => node.classList.contains("is-active"))
      )
        break
    }
    assert.equal(
      await trigger.evaluate((node) => node.classList.contains("is-active")),
      true
    )
    const outline = await trigger.evaluate(
      (node) => getComputedStyle(node).outlineStyle
    )
    await pad(0)
    await advance(1000)
    const dialog = page.getByRole("dialog", { name: /層の探索装備$/ })
    await dialog.waitFor()
    assert.deepEqual(
      await page.evaluate(() => ({
        armor: window.__findsProbe.armor,
        weapon: window.__findsProbe.weapon,
      })),
      { armor: [], weapon: [] },
      "まだ装備を選んでいないのに比較している"
    )
    const armorRow = dialog.getByRole("button", {
      name: expected.armorName,
      exact: true,
    })
    for (let step = 0; step < 20; step++) {
      await pad(5)
      if (
        await armorRow.evaluate((node) => node.classList.contains("is-active"))
      )
        break
    }
    assert.equal(
      await armorRow.evaluate((node) => node.classList.contains("is-active")),
      true
    )
    await pad(0)
    await advance(1000)
    const counts = await page.evaluate(() => ({
      armor: window.__findsProbe.armor,
      weapon: window.__findsProbe.weapon,
    }))
    console.log(
      `${width}: 防具を選んだ後の比較計算 防具${counts.armor.length}回（${new Set(counts.armor).size}種類）、武器${counts.weapon.length}回、選択枠=${outline}`
    )
    assert.ok(counts.armor.length > 0, "選んだ防具を比較していない")
    assert.deepEqual(
      [...new Set(counts.armor)],
      [expected.armor],
      "未選択の防具まで比較している"
    )
    assert.deepEqual(counts.weapon, [], "開いていない武器タブまで比較している")
    assert.notEqual(outline, "none", "パッドで選んだ目標ボタンの枠がない")
    assert.ok(
      (
        await dialog.getByRole("region", { name: "選んだ品の詳細" }).innerText()
      ).includes(expected.armorName)
    )
    await pad(1)
    await advance(1000)
    await dialog.waitFor({ state: "detached" })
    assert.equal(
      await trigger.evaluate(
        (node) =>
          node.classList.contains("is-active") &&
          node === document.activeElement
      ),
      true
    )
    if (width === 390)
      await page.screenshot({ path: "/tmp/dnd-finds-navigation.png" })
    await pad(0)
    await advance(1000)
    await dialog.waitFor()
    assert.deepEqual(
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      ),
      expected.save,
      "目標を見るだけで装備や行き先を変更した"
    )
    await page.close()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
