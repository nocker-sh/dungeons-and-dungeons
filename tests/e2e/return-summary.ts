import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"
import layers from "@/content/data/layers.json"
import settings from "@/content/data/settings.json"
import { PARTY_SLOTS } from "@/lib/wiz/content/constants"

const browser = await launch()
const errors: string[] = []
try {
  for (const width of process.argv[2]
    ? [Number(process.argv[2])]
    : [320, 390, 1280]) {
    for (const layer of layers) {
      for (const empty of layer.no === 0 ? [false, true] : [false]) {
        const page = await openPage(browser, { width, height: 760 }, errors)
        await page.goto(
          BASE_URL +
            frameUrl(
              parseStudioConfig({
                scene: "route",
                width,
                height: 760,
                duration: 20000,
              })
            )
        )
        await page.waitForFunction(
          () => window.__devStudio?.ready || window.__devStudioError
        )
        const fixture = await page.evaluate(
          async ({ layer, empty, junk, rareJunk }) => {
            const runtime = window.__devStudio as StudioRuntime
            await runtime.advance(2500)
            const game = runtime.game!
            const save = game.save()
            const phase = save.snapshot.phase
            if (phase.type !== "expedition") throw new Error("探索でない")
            const party = game.queries.party(game.state)
            const goods = empty
              ? []
              : [
                  { good: junk, count: 2 },
                  { good: rareJunk, count: 3 },
                ]
            const picked = empty ? [] : ["return-picked-1", "return-picked-2"]
            const candidate = {
              ...save,
              snapshot: {
                ...save.snapshot,
                reached: Math.min(layer.no + 1, 4),
                cleared: layer.no === 4,
                endingSeen: false,
                gold: 5000,
                members: save.snapshot.members.map((member) => ({
                  ...member,
                  exp: empty
                    ? 0
                    : (party.find((entry) => entry.id === member.id)?.next ??
                      0),
                })),
                bag: [
                  ...save.snapshot.bag.filter(
                    (entry) => !goods.some((good) => entry.good === good.good)
                  ),
                  ...goods,
                ],
                gear: [
                  ...save.snapshot.gear,
                  ...picked.map((id) => ({
                    ...save.snapshot.gear[0],
                    id,
                    owner: null,
                  })),
                ],
                phase: {
                  ...phase,
                  expedition: {
                    ...phase.expedition,
                    layer: layer.id,
                    at: layer.stations.find((station) => station.boss)!.id,
                    visited: [
                      "s",
                      "n8",
                      layer.stations.find((station) => station.boss)!.id,
                    ],
                    cleared: true,
                    pending: null,
                    loot: { gold: empty ? 0 : 1234, goods, weapons: picked },
                  },
                },
              },
            }
            const issue = game.restore(JSON.parse(JSON.stringify(candidate)))
            if (issue)
              throw new Error(`${issue.message}: ${String(issue.cause)}`)
            await runtime.advance(4500)
            const route = game.queries.route(game.state)!
            return {
              save: game.save(),
              balance: route.returnBalance,
              bonus: route.bonus,
              names: game.queries
                .party(game.state)
                .filter((member) => member.levelUpReady)
                .map((member) => member.name),
              growable: game.queries
                .party(game.state)
                .filter((member) => !member.hero).length,
            }
          },
          { layer, empty, junk: settings.junk, rareJunk: settings.rareJunk }
        )
        const summary = page.getByRole("region", {
          name: "突破と帰還のまとめ",
          exact: true,
        })
        await summary.waitFor({ state: "visible" })
        await summary.focus()
        await page.keyboard.press("Space")
        await page.evaluate(() => window.__devStudio!.advance(6500))
        assert.deepEqual(
          await page.evaluate(() =>
            (window.__devStudio as StudioRuntime).game!.save()
          ),
          fixture.save,
          "まとめ欄のSpaceで帰還せず、探索状態を保持する"
        )
        const maxScroll = await summary.evaluate(
          (el) => el.scrollHeight - el.clientHeight
        )
        if (maxScroll > 0)
          assert.ok(
            await summary.evaluate((el) => el.scrollTop > 0),
            "Spaceでまとめを下へ読む"
          )
        for (const key of [
          "Enter",
          "Home",
          "ArrowDown",
          "PageDown",
          "End",
          "ArrowUp",
          "PageUp",
          "Shift+Space",
        ])
          await page.keyboard.press(key)
        await page.evaluate(() => window.__devStudio!.advance(7000))
        assert.deepEqual(
          await page.evaluate(() =>
            (window.__devStudio as StudioRuntime).game!.save()
          ),
          fixture.save,
          "本文のキー操作は帰還・隊列編集を実行しない"
        )
        await page.keyboard.press("Home")
        assert.equal(await summary.evaluate((el) => el.scrollTop), 0)
        await page.evaluate(() => {
          const pad = {
            index: 0,
            buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
            axes: [0, 0, 0, 1],
          }
          Object.assign(window, { returnSummaryPad: pad })
          Object.defineProperty(navigator, "getGamepads", {
            configurable: true,
            value: () => [pad],
          })
        })
        await page.evaluate(() => window.__devStudio!.advance(7600))
        if (maxScroll > 0)
          assert.ok(
            await summary.evaluate((el) => el.scrollTop > 0),
            "右スティックでまとめを読む"
          )
        await page.evaluate(() => {
          ;(
            window as unknown as { returnSummaryPad: { axes: number[] } }
          ).returnSummaryPad.axes[3] = 0
        })
        if (
          !(await summary
            .getByText(`${layer.no}層を突破！`, { exact: true })
            .isVisible())
        )
          throw new Error("突破がない")
        const growth = summary.locator("[data-expedition-growth]")
        if (empty) {
          if (await growth.count()) throw new Error("成長できないのに案内")
          if (!(await summary.getByText("なし", { exact: true }).isVisible()))
            throw new Error("空の戦利品表示なし")
        } else {
          // 主人公は経験値で育たないので、出撃の3人のうち主人公以外の全員
          if (
            fixture.names.length !== PARTY_SLOTS - 1 ||
            fixture.names.length !== fixture.growable
          )
            throw new Error(`${PARTY_SLOTS - 1}人成長の前提が違う`)
          for (const name of fixture.names)
            if (!(await growth.innerText()).includes(name))
              throw new Error("成長の名前が欠ける")
          if ((await summary.locator("[data-carried-entry]").count()) !== 4)
            throw new Error("戦利品が欠ける")
        }
        const money = `帰還後の所持金 ${fixture.balance}G${fixture.bonus > 0 ? `（手当て +${fixture.bonus}G）` : ""}`
        if (!(await summary.getByText(money, { exact: true }).isVisible()))
          throw new Error("帰還金額が違う")
        const next = layers.find((entry) => entry.no === layer.no + 1)
        const nextText = next
          ? `次の挑戦：${next.no}層・${next.name}`
          : "街へ戻ると踏破の結果を見られる"
        const nextHint = summary.getByText(nextText, { exact: true })
        await page.keyboard.press("End")
        assert.ok(
          Math.abs(
            (await summary.evaluate((el) => el.scrollTop)) - maxScroll
          ) <= 1
        )
        assert.ok(
          await nextHint.evaluate((el) => {
            const area = el
              .closest("[data-expedition-return-summary]")!
              .getBoundingClientRect()
            const text = el.getBoundingClientRect()
            return text.top >= area.top && text.bottom <= area.bottom
          }),
          "Endで次の挑戦まで表示する"
        )
        if (!(await nextHint.isVisible())) throw new Error("次の挑戦を読めない")
        const bounds = await summary.boundingBox()
        const close = page.getByRole("button", {
          name: "街へ帰還",
          exact: true,
        })
        const closeBounds = await close.boundingBox()
        if (
          !bounds ||
          !closeBounds ||
          bounds.x < 0 ||
          bounds.y < 0 ||
          bounds.x + bounds.width > width ||
          bounds.y + bounds.height > 760
        )
          throw new Error("まとめが画面外")
        if (
          bounds.x < closeBounds.x + closeBounds.width &&
          bounds.x + bounds.width > closeBounds.x &&
          bounds.y < closeBounds.y + closeBounds.height &&
          bounds.y + bounds.height > closeBounds.y
        ) {
          await page.screenshot({ path: "/tmp/dnd-return-summary-overlap.png" })
          throw new Error(
            `帰還ボタンと重なる ${JSON.stringify({ width, bounds, closeBounds })}`
          )
        }
        const current = await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )
        if (current !== JSON.stringify(fixture.save))
          throw new Error("閲覧で保存変更")
        await page.screenshot({
          path: `/tmp/dnd-return-summary-${width}-${layer.no}-${empty}.png`,
        })
        await close.click()
        await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).advance(10000)
        )
        const returned = await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).game!.save()
        )
        if (
          returned.snapshot.phase.type !== "town" ||
          returned.snapshot.gold !== fixture.balance
        )
          throw new Error("帰還結果が違う")
        for (const key of ["bag", "gear", "party"] as const)
          if (
            JSON.stringify(returned.snapshot[key]) !==
            JSON.stringify(fixture.save.snapshot[key])
          )
            throw new Error(`${key}を帰還で失った`)
        if (layer.no === 4) {
          await page
            .getByRole("dialog", { name: "踏破の結果" })
            .waitFor({ state: "visible" })
          await page
            .getByRole("button", { name: "まだ潜る", exact: true })
            .click()
          await page.evaluate(() =>
            (window.__devStudio as StudioRuntime).advance(14000)
          )
        }
        await page
          .getByRole("button", { name: "ダンジョン", exact: true })
          .waitFor({ state: "visible" })
        console.log(
          `PASS ${width} layer${layer.no} empty=${empty}: 突破・戦利品・成長・次の挑戦・帰還保持`
        )
        await page.close()
      }
    }
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
