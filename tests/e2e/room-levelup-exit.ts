import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { tap } from "@/tests/e2e/tap"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"

const browser = await launch()
try {
  for (const width of [320, 1280]) {
    const errors: string[] = []
    const page = await openPage(browser, { width, height: 800 }, errors)
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "room-normal",
            width,
            height: 800,
            duration: 20000,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    assert.equal(await page.evaluate(() => window.__devStudioError), undefined)
    const before = await page.evaluate(async () => {
      const runtime = window.__devStudio as StudioRuntime
      await runtime.advance(2500)
      const game = runtime.game!
      const saved = game.save()
      const party = game.queries.party(game.state)
      const error = game.restore({
        ...saved,
        snapshot: {
          ...saved.snapshot,
          gold: 1000,
          members: saved.snapshot.members.map((member) => ({
            ...member,
            exp: party.find((entry) => entry.id === member.id)?.next ?? 0,
          })),
        },
      })
      if (error) throw error
      await runtime.advance(3000)
      return game.state.members
        .filter((member) => game.state.party.includes(member.id))
        .map(({ id, lv, stats }) => ({
          id,
          lv,
          stats,
          name: game.queries.member(game.state, id)!.name,
        }))
    })
    await tap(page, page.getByRole("button", { name: "泊まる", exact: true }))
    const advance = (time: number) =>
      page.evaluate((time) => window.__devStudio!.advance(time), time)
    await advance(6500)
    const rested = await page.evaluate(() =>
      (window.__devStudio as StudioRuntime).game!.save()
    )
    assert.equal(rested.snapshot.gold, 980)
    assert.equal(
      rested.snapshot.members.filter((member) =>
        before.some((entry) => entry.id === member.id && member.lv > entry.lv)
      ).length,
      2,
      "仲間2人が成長する"
    )

    const grown = rested.snapshot.members.filter((member) =>
      before.some((entry) => entry.id === member.id && member.lv > entry.lv)
    )
    const accessibility = await page.context().newCDPSession(page)
    for (const [index, time] of [6500, 10000].entries()) {
      await advance(time)
      const member = grown[index]
      const previous = before.find((entry) => entry.id === member.id)!
      const tree = await accessibility.send("Accessibility.getFullAXTree")
      const exposed = tree.nodes.filter((node) => !node.ignored)
      assert.ok(
        exposed.some(
          (node) =>
            node.role?.value === "region" &&
            node.name?.value === `${previous.name}のレベルアップ`
        ),
        "成長した仲間の名前をアクセシビリティツリーへ公開する"
      )
      for (const label of [
        `レベル ${previous.lv}から${member.lv}`,
        ...(
          [
            ["HP", "maxHp"],
            ["筋力", "str"],
            ["技量", "tec"],
            ["速さ", "spd"],
          ] as const
        ).map(([name, stat]) => {
          const from = previous.stats[stat]
          const to = member.stats[stat]
          return `${name} ${from}から${to}、${to > from ? `${to - from}増加` : "変化なし"}`
        }),
      ])
        assert.ok(
          exposed.some(
            (node) => node.role?.value === "group" && node.name?.value === label
          ),
          `成長前後の値を読み取れる: ${label}`
        )
      const ok = page.getByRole("button", { name: "OK", exact: true })
      const original = await ok.elementHandle()
      assert.ok(original)
      await tap(page, ok)
      await advance(time + 50)
      assert.equal(
        await original.evaluate((element) => element.isConnected),
        true,
        "退場アニメーションが終わる前に次の仲間へ進まない"
      )
      assert.equal(await original.isDisabled(), true)
      if (time === 6500)
        await page.screenshot({ path: `/tmp/dnd-levelup-exit-${width}.png` })
      await advance(time + 350)
      assert.equal(
        await original.evaluate((element) => element.isConnected),
        false,
        "退場が終わると次へ進む"
      )
      await original.dispose()
    }
    await advance(12000)
    assert.equal(
      await page.getByRole("button", { name: "OK", exact: true }).count(),
      0
    )
    assert.ok(
      await page.getByRole("button", { name: "寝る", exact: true }).isVisible()
    )
    const night = await accessibility.send("Accessibility.getFullAXTree")
    assert.ok(
      night.nodes.some(
        (node) =>
          !node.ignored &&
          node.role?.value === "StaticText" &&
          node.name?.value === "まだ起きている人の話し声が聞こえる……"
      ),
      "雑談と就寝を選ぶ前の説明も読み取れる"
    )
    const sleep = page.getByRole("button", { name: "寝る", exact: true })
    const choice = await sleep.elementHandle()
    assert.ok(choice)
    await tap(page, sleep)
    await advance(12050)
    assert.equal(await choice.evaluate((element) => element.isConnected), true)
    assert.equal(await page.getByText("ZZZ…", { exact: true }).count(), 0)
    await advance(12350)
    assert.equal(await choice.evaluate((element) => element.isConnected), false)
    assert.equal(await page.getByText("ZZZ…", { exact: true }).count(), 1)
    await choice.dispose()
    assert.deepEqual(
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      ),
      rested,
      "成長結果を閉じても宿泊料や成長を重複適用しない"
    )
    assert.deepEqual((await advance(12350)).errors, [])
    assert.deepEqual(errors, [])
    await accessibility.detach()
    await page.close()
    console.log(`${width}px: 仲間2人の成長を退場完了まで待ち、資産を保持`)
  }
} finally {
  await browser.close()
}
