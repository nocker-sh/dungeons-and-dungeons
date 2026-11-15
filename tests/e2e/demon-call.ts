import assert from "node:assert/strict"
import { STUDIO_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { tap } from "@/tests/e2e/tap"
import { waitForStudio } from "@/scripts/studio-browser"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/development/preview/studio-runtime"

/**
 * 「〇〇を呼ぶ」：プレイヤーが契約した悪魔を1戦闘に1回だけ呼ぶ。
 * 敵全員へ当たり、仲間の手番は消えず、使った後はボタンが消え、保存にも残ることを画面の操作で確かめる。
 */
const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280]) {
    const page = await openPage(browser, { width, height: 844 }, errors)
    await page.routeWebSocket("**/*", () => {})
    await page.goto(
      STUDIO_URL +
        frameUrl(
          parseStudioConfig({
            scene: "battle",
            duration: 60000,
            width,
            height: 844,
          })
        )
    )
    assert.equal((await waitForStudio(page)).error, undefined)
    let time = 3000
    const advance = async (elapsed = 1000) => {
      time += elapsed
      await page.evaluate(
        async (time) => window.__devStudio!.advance(time),
        time
      )
    }
    await advance(0)
    // 仲間の手番から始め、敵は一撃で倒れないHPにする（呼んだ後も戦闘が続く）
    const fixture = await page.evaluate(() => {
      const game = (window.__devStudio as StudioRuntime).game!
      const saved = game.save()
      if (saved.snapshot.phase.type !== "battle")
        throw new Error("戦闘ではない")
      const battle = saved.snapshot.phase.battle
      const actor = saved.snapshot.party[0]!
      const issue = game.restore({
        ...saved,
        snapshot: {
          ...saved.snapshot,
          phase: {
            ...saved.snapshot.phase,
            battle: {
              ...battle,
              turn: 0,
              demonCalled: false,
              foes: battle.foes.map((foe) => ({ ...foe, hp: 999, maxHp: 999 })),
              order: [
                { kind: "member", id: actor },
                ...battle.order.filter(
                  (ref) => !(ref.kind === "member" && ref.id === actor)
                ),
              ],
            },
          },
        },
      })
      if (issue) throw issue
      const view = game.queries.battle(game.state)!
      if (!view.demonCall?.usable) throw new Error("悪魔を呼べない")
      return {
        actor,
        name: game.queries.member(game.state, actor)!.name,
        demon: view.demonCall.demonName,
        foes:
          game.state.phase.type === "battle"
            ? game.state.phase.battle.foes.map((foe) => ({
                id: foe.id,
                hp: foe.hp,
              }))
            : [],
      }
    })
    assert.ok(fixture.foes.length >= 2, "敵全員への命中を確かめる敵が足りない")
    await advance(2000)
    const call = page.getByRole("button", {
      name: new RegExp(`^${fixture.demon}を呼ぶ（`),
    })
    await call.waitFor()
    const weapons = page.getByRole("listbox", {
      name: "武器のワザと祝福",
      exact: true,
    })
    await weapons.waitFor()
    await tap(page, call)
    // 指示が一度引っ込み、演出が終わって同じ仲間へ戻るまで仮想時計を進める
    for (let index = 0; index < 20 && (await weapons.isVisible()); index++)
      await advance(200)
    assert.equal(await weapons.isVisible(), false, "呼んでも指示が引っ込まない")
    for (let index = 0; index < 30 && !(await weapons.isVisible()); index++)
      await advance(500)
    const after = await page.evaluate(() => {
      const game = (window.__devStudio as StudioRuntime).game!
      const state = game.state
      if (state.phase.type !== "battle") throw new Error("戦闘が終わった")
      const view = game.queries.battle(state)!
      return {
        current: view.current,
        demonCall: view.demonCall,
        foes: state.phase.battle.foes.map((foe) => ({
          id: foe.id,
          hp: foe.hp,
        })),
        save: game.save(),
      }
    })
    for (const foe of fixture.foes)
      assert.ok(
        after.foes.find((entry) => entry.id === foe.id)!.hp < foe.hp,
        `${width}: 敵 ${foe.id} に当たっていない`
      )
    assert.deepEqual(
      after.current,
      { kind: "member", id: fixture.actor },
      `${width}: 悪魔を呼ぶと${fixture.name}の手番が消えた`
    )
    assert.equal(await weapons.isVisible(), true, "同じ仲間へ指示が戻らない")
    assert.equal(await call.count(), 0, "1戦闘に2回目を呼べる")
    assert.equal(after.demonCall?.usable, false)
    assert.equal(after.demonCall?.called, true)
    assert.equal(
      after.save.snapshot.phase.type === "battle" &&
        after.save.snapshot.phase.battle.demonCalled,
      true,
      "保存に呼んだ記録がない"
    )
    await page.screenshot({ path: `/tmp/dnd-demon-call-${width}.png` })
    // 保存から戻しても、同じ戦闘では呼べないまま
    const restored = await page.evaluate((save) => {
      const game = (window.__devStudio as StudioRuntime).game!
      const issue = game.restore(save)
      if (issue) throw issue
      return game.queries.battle(game.state)!.demonCall
    }, after.save)
    assert.equal(restored?.called, true)
    assert.equal(restored?.usable, false)
    await advance(2000)
    assert.equal(await call.count(), 0, "保存から戻すと再び呼べる")
    console.log(
      `${width}px: ${fixture.demon}を呼ぶと敵全員に当たり、${fixture.name}の手番が残り、ボタンが消えて保存に残る`
    )
    await page.close()
  }
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
