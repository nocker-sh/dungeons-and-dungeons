import assert from "node:assert/strict"
import { GameDefinition } from "@/lib/wiz/definition/game-definition"
import { realContent } from "@/lib/wiz/testing/real-content"
import { startedState } from "@/lib/wiz/testing/started-state"
import { launch } from "@/tests/e2e/launch"
import { BASE_URL, STUDIO_URL } from "@/tests/e2e/lib"

const key = "dungeons-and-dungeons/save"
const definition = new GameDefinition(realContent())
const save = JSON.stringify(
  definition.create(undefined, startedState(definition)).save()
)
const browser = await launch()
try {
  const page = await browser.newPage({ ignoreHTTPSErrors: true })
  // ゲーム側の本来のセーブ（別物）を置き、試遊で変わらないことを確かめる。
  await page.goto(BASE_URL + "/manifest.json")
  await page.evaluate((key) => localStorage.setItem(key, "original"), key)
  await page.goto(STUDIO_URL + "/save")
  await page.getByLabel("セーブのJSON").fill(save)
  await page.getByRole("button", { name: "試遊を始める" }).click()
  const game = page.frameLocator("iframe[title='試遊']")
  await game.locator("[data-screen-content]").first().waitFor()
  assert.match(await game.locator("body").innerText(), /街/)
  const frame = page.frames().find((frame) => frame.url().startsWith(BASE_URL))
  assert.ok(frame)
  assert.equal(
    await frame.evaluate((key) => localStorage.getItem(key), key),
    "original"
  )
  console.log("スタジオがiframeでセーブを送り、ゲームは本来のセーブを保持した")
} finally {
  await browser.close()
}
