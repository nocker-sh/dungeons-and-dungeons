import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { BASE_URL, VIEWPORTS } from "@/tests/e2e/lib"
import { FIRE } from "@/tests/e2e/fire"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { press } from "@/tests/e2e/press"

/** 実際のMotion/WAAPIを途中で止め、秒数を過ぎてもダメージ・手番を追い越さないことを確認する。敵のHPは画面に出さない。 */
const directory = "node_modules/.cache/studio/animation"
await mkdir(directory, { recursive: true })
const browser = await launch()
try {
  for (const viewport of VIEWPORTS) {
    const errors: string[] = []
    const page = await openPage(browser, viewport, errors)
    await page.goto(`${BASE_URL}/previews/battle`)
    await page.locator(FIRE).waitFor()
    const read = () =>
      page.evaluate((fire) => {
        const numbers = [...document.querySelectorAll<HTMLElement>("div")]
          .filter((element) => element.style.zIndex === "42")
          .map((element) => Number(element.textContent))
        return {
          hpShown: document.querySelectorAll(".game .hpnum, .game .gauge")
            .length,
          damage: numbers.length ? Math.max(...numbers) : null,
          order: document.querySelector(".order")?.getAttribute("aria-label"),
          // 行動順の顔（名前は出さない）。いまの手番と次の手番の絵で見分ける
          faces: [...document.querySelectorAll(".order > div")]
            .slice(0, 2)
            .map((slot) => slot.querySelector("img")?.getAttribute("src")),
          commands: document.querySelectorAll(fire).length,
        }
      }, FIRE)
    const before = await read()
    assert.equal(before.hpShown, 0, "敵のHPの数字・ゲージを出さない")
    // 同一フレーム内の二重入力も1行動にする。
    await page.locator(FIRE).evaluate((element) => {
      const foe = element as HTMLElement
      foe.click()
      foe.click()
    })
    await page.waitForFunction(() => {
      const animations = document.getAnimations().filter((animation) => {
        const target = (animation.effect as KeyframeEffect | null)?.target
        return target instanceof HTMLElement && target.style.zIndex === "42"
      })
      if (!animations.length) return false
      for (const animation of animations) animation.pause()
      return true
    })
    // 旧実装の完了推定時間より十分長く待つ。停止中に手番が進んだら失敗。
    await page.waitForTimeout(1800)
    const paused = await read()
    assert.equal(paused.hpShown, 0)
    assert.equal(
      paused.order,
      before.order,
      "停止した演出を次の手番が追い越した"
    )
    assert.equal(paused.commands, 0, "演出停止中に次の指示を受け付けた")
    await page.screenshot({ path: `${directory}/${viewport.name}-paused.png` })
    // 再開後にダメージの数字が数え上がるのを見ておく（敵のHPは画面に出さない）
    await page.evaluate(() => {
      const seen = window as unknown as { damageSeen: number }
      seen.damageSeen = 0
      const watch = () => {
        for (const element of document.querySelectorAll<HTMLElement>("div"))
          if (element.style.zIndex === "42")
            seen.damageSeen = Math.max(
              seen.damageSeen,
              Number(element.textContent) || 0
            )
        requestAnimationFrame(watch)
      }
      watch()
      for (const animation of document.getAnimations()) {
        const target = (animation.effect as KeyframeEffect | null)?.target
        if (target instanceof HTMLElement && target.style.zIndex === "42")
          animation.play()
      }
    })
    await page.waitForFunction(
      (order) =>
        document.querySelector(".order")?.getAttribute("aria-label") !== order,
      before.order
    )
    const finished = await read()
    const damage = await page.evaluate(
      () => (window as unknown as { damageSeen: number }).damageSeen
    )
    assert.ok(damage > 0, "再開後にダメージの数字が数え上がらない")
    assert.equal(finished.hpShown, 0)
    assert.ok(before.faces[1], "次の手番の顔がない")
    assert.equal(
      finished.faces[0],
      before.faces[1],
      "二重入力で次の手番を飛ばした"
    )
    await page.screenshot({
      path: `${directory}/${viewport.name}-finished.png`,
    })
    await writeFile(
      `${directory}/${viewport.name}.json`,
      JSON.stringify({ before, paused, finished, damage }, null, 2)
    )
    assert.deepEqual(errors, [])
    // 画面の退場完了後にだけ、次の施設を表示する。
    await page.goto(`${BASE_URL}/previews/town`)
    await press(page, "冒険者ギルド")
    await page.getByRole("button", { name: "受付", exact: true }).waitFor()
    await press(page, "受付")
    await page.getByRole("button", { name: "会話", exact: true }).waitFor()
    await press(page, "会話")
    await page
      .getByRole("button", { name: "会話を進める", exact: true })
      .waitFor()
    assert.deepEqual(errors, [])
    console.log(`${viewport.name}: 演出停止・再開・二重入力・施設遷移 OK`)
    await page.close()
  }
} finally {
  await browser.close()
}
