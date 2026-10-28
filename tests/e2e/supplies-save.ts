import assert from "node:assert/strict"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { aState } from "@/lib/wiz/testing/state-builder"
import { contentId } from "@/lib/wiz/testing/content-id"
import { realContent } from "@/lib/wiz/testing/real-content"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { talkUntil } from "@/tests/e2e/talk-until"

const potion = contentId("potion")
const ether = contentId("ether")
const definition = new GameDefinition(realContent())
const etherName = definition.catalog.good(ether)!.name
const game = definition.create(
  undefined,
  aState()
    .withBag([
      { good: potion, count: 3 },
      { good: ether, count: 2 },
      { good: potion, count: 4 },
    ])
    .build()
)
const initial = JSON.stringify(game.save())
const key = "dungeons-and-dungeons/save"
const browser = await launch()
const errors: string[] = []
try {
  for (const width of [390, 1280]) {
    const page = await openPage(browser, { width, height: 844 }, errors)
    await page.routeWebSocket("**/*", () => {})
    await page.addInitScript(
      ({ key, initial }) => {
        // 再読み込みでは実際の自動保存を使い、最初の保存へ戻さない。
        if (localStorage.getItem(key) === null)
          localStorage.setItem(key, initial)
      },
      { key, initial }
    )
    await page.goto(BASE_URL)
    await talkUntil(
      page,
      page.getByRole("button", { name: "バッグ", exact: true })
    )
    assert.equal(await page.getByRole("alert").count(), 0)
    const before = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      key
    )
    await page.getByRole("button", { name: "バッグ", exact: true }).click()
    await page
      .getByRole("button", { name: "持ち出しを準備", exact: true })
      .click()
    const supplies = page.getByRole("dialog", {
      name: "倉庫と手持ち",
      exact: true,
    })
    await supplies
      .getByRole("button", { name: `${etherName}を倉庫へ戻す`, exact: true })
      .click()
    await page.waitForFunction(
      ({ key, ether }) => {
        const saved = JSON.parse(localStorage.getItem(key)!)
        return saved.snapshot.provisions?.some(
          (entry: { good: string; count: number }) =>
            entry.good === ether && entry.count === 1
        )
      },
      { key, ether }
    )
    const saved = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      key
    )
    assert.deepEqual(saved.snapshot, {
      ...before.snapshot,
      provisions: [
        { good: potion, count: 6 },
        { good: ether, count: 1 },
      ],
    })
    await page.reload()
    await talkUntil(
      page,
      page.getByRole("button", { name: "バッグ", exact: true })
    )
    assert.equal(
      await page.getByRole("alert").count(),
      0,
      "再起動すると保存が拒否された"
    )
    await page.getByRole("button", { name: "バッグ", exact: true }).click()
    await page
      .getByRole("button", { name: "持ち出しを準備", exact: true })
      .click()
    assert.ok((await supplies.innerText()).includes("倉庫と手持ち 7/8"))
    assert.deepEqual(
      await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key),
      saved
    )
    console.log(
      `${width}: 分かれた道具の束から持ち替え・自動保存・再読み込み・資産保持 OK`
    )
    await page.close()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
