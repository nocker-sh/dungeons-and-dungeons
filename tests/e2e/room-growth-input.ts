import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"

const browser = await launch()
try {
  for (const [width, party] of [
    [320, ["hero", "alda", "mort"]],
    [1280, ["hero", "rivet", "husky"]],
  ] as const) {
    const errors: string[] = []
    const page = await openPage(browser, { width, height: 800 }, errors)
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "room-growth",
            width,
            height: 800,
            party: [...party],
            duration: 15000,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    assert.equal(await page.evaluate(() => window.__devStudioError), undefined)
    const before = await page.evaluate(async () => {
      const runtime = window.__devStudio as StudioRuntime
      await runtime.advance(4500)
      const game = runtime.game!
      return {
        save: game.save(),
        member: game.queries
          .party(game.state)
          .find((member) => member.levelUpReady)!,
        room: game.queries.rooms(game.state).find((room) => room.levelUp)!,
      }
    })
    const note = page.getByRole("region", {
      name: "成長できる仲間",
      exact: true,
    })
    await note.focus()
    await page.keyboard.press("Space")
    await page.evaluate(() => window.__devStudio!.advance(5500))
    assert.deepEqual(
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      ),
      before.save,
      "成長予定を読むSpaceで宿泊しない"
    )
    for (const key of [
      "Enter",
      "ArrowDown",
      "ArrowUp",
      "PageDown",
      "PageUp",
      "End",
      "Home",
      "Shift+Space",
    ])
      await page.keyboard.press(key)
    await page.evaluate(() => window.__devStudio!.advance(6500))
    assert.equal(
      await note.evaluate((el) => el === document.activeElement),
      true
    )
    assert.equal(
      await note.textContent(),
      `レベルアップ予定：${before.member.name}`
    )
    assert.deepEqual(
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      ),
      before.save
    )
    const stay = page.getByRole("button", { name: "泊まる", exact: true })
    await stay.focus()
    await page.keyboard.press("Enter")
    await page.evaluate(() => window.__devStudio!.advance(10000))
    const after = await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).game!.save()
    )
    assert.equal(
      after.snapshot.gold,
      before.save.snapshot.gold - before.room.price
    )
    assert.equal(
      after.snapshot.members.find((member) => member.id === before.member.id)!
        .lv,
      before.member.lv + 1
    )
    assert.equal(
      await page
        .getByRole("region", {
          name: `${before.member.name}のレベルアップ`,
          exact: true,
        })
        .count(),
      1
    )
    assert.deepEqual(errors, [])
    console.log(
      `${width}/${before.member.name}: 成長予定のキー操作で資産保持、泊まるのEnterで一度だけ支払い・成長`
    )
    await page.close()
  }
} finally {
  await browser.close()
}
