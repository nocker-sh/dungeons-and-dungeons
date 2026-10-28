import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { BASE_URL, VIEWPORTS } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import { animationTiming } from "@/client/components/stage/timing"
import { battleResultTiming } from "@/client/components/stage/battle-result-timing"

const directory = "node_modules/.cache/studio/timing"
await mkdir(directory, { recursive: true })
const browser = await launch()
try {
  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({ viewport, ignoreHTTPSErrors: true })
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    const config = parseStudioConfig({
      width: viewport.width,
      height: viewport.height,
      foes: ["haribote-adult"],
      actions: [{ at: 2500, label: "放つ" }],
    })
    await page.goto(BASE_URL + frameUrl(config))
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    assert.equal(await page.evaluate(() => window.__devStudioError), undefined)
    const inspect = (time: number) =>
      page.evaluate(async (time) => {
        const inspection = await window.__devStudio!.advance(time)
        // 敵のHPは画面に出さないので、エンジンの戦闘Queryから読む
        const battle = inspection.battle as { foes: { hp: number }[] } | null
        return {
          inspection,
          hp: battle?.foes[0]?.hp ?? Number.NaN,
          hpShown: document.querySelectorAll(".game .hpnum, .game .gauge")
            .length,
          order: document
            .querySelector('[aria-label^="行動順"]')
            ?.getAttribute("aria-label"),
          commands: document.querySelectorAll('[data-action="放つ"]').length,
        }
      }, time)
    const initial = await inspect(2000)
    assert.equal(initial.commands, 1)
    assert.equal(initial.hpShown, 0, "敵のHPの数字・ゲージを出さない")
    const impactStart = 2500 + animationTiming.special
    // 敵のHPは画面に出さず、ジェムロードはこの一撃では倒れない
    const foeHit = battleResultTiming(1, 0, { hp: false, knockout: false })
    const hpAt = impactStart + foeHit.hpAt
    const completion = impactStart + foeHit.duration
    const beforeHp = await inspect(hpAt - 10)
    assert.equal(beforeHp.hpShown, 0, "演出中も敵のHPを出さない")
    assert.equal(
      beforeHp.order,
      initial.order,
      "演出中に次の手番へ表示を切り替えない"
    )
    assert.equal(beforeHp.commands, 0)
    const settledHp = await inspect(hpAt + animationTiming.hp + 10)
    assert.ok(settledHp.hp < initial.hp, "敵への被害がエンジンに入る")
    assert.equal(settledHp.hpShown, 0)
    assert.equal(settledHp.commands, 0)
    const beforeNext = await inspect(completion - 10)
    assert.equal(beforeNext.order, initial.order)
    assert.equal(beforeNext.commands, 0)
    const next = await inspect(completion + animationTiming.enter + 100)
    assert.notEqual(next.order, initial.order)
    assert.equal(next.commands, 1)
    assert.equal(next.hp, settledHp.hp, "次の手番までに敵のHPが変わらない")
    assert.equal(next.hpShown, 0)
    assert.deepEqual(next.inspection.errors, [])
    assert.deepEqual(next.inspection.operations, [
      { at: 2500, label: "放つ", success: true },
    ])
    await page.screenshot({ path: `${directory}/battle-${viewport.name}.png` })
    await writeFile(
      `${directory}/battle-${viewport.name}.json`,
      JSON.stringify(
        { initial, beforeHp, settledHp, beforeNext, next },
        null,
        2
      )
    )

    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "components",
            width: viewport.width,
            height: viewport.height,
            actions: [{ at: 1000, label: "カットイン" }],
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    assert.equal(await page.evaluate(() => window.__devStudioError), undefined)
    const middle = await inspect(1600)
    assert.ok(
      middle.inspection.text.includes("スキル発動！"),
      "指定800msの演出を途中で消さない"
    )
    assert.ok(
      middle.inspection.animations.some(
        (track) => track.start === 1000 && track.duration === 800
      )
    )
    const finished = await inspect(1900)
    assert.ok(
      !finished.inspection.text.includes("スキル発動！"),
      "指定時間後に残し続けない"
    )
    assert.deepEqual(finished.inspection.errors, [])
    assert.deepEqual(errors, [])
    console.log(`${viewport.name}: HP・行動順・指示・カットイン OK`)
    await page.close()
  }
} finally {
  await browser.close()
}
