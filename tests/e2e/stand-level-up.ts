import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"
import { PARTY_SLOTS } from "@/lib/wiz/content/constants"
const browser = await launch()
const errors: string[] = []
try {
  for (const width of [320, 390, 1280]) {
    const page = await openPage(browser, { width, height: 760 }, errors)
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "stand-find-armor-1",
            duration: 15000,
            width,
            height: 760,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    for (const [index, ready] of [false, true, false].entries()) {
      const before = await page.evaluate(
        async ({ index, ready }) => {
          const runtime = window.__devStudio as StudioRuntime
          await runtime.advance(2500 + index * 3000)
          const game = runtime.game!
          const save = game.save()
          const owner = save.snapshot.gear.find(
            (entry) => entry.id === "preview-find-armor"
          )!.owner!
          const member = game.queries.member(game.state, owner)!
          const issue = game.restore({
            ...save,
            snapshot: {
              ...save.snapshot,
              members: save.snapshot.members.map((entry) =>
                entry.id === owner
                  ? { ...entry, exp: member.next - (ready ? 0 : 1) }
                  : entry
              ),
            },
          })
          if (issue) throw issue
          await runtime.advance(3500 + index * 3000)
          if (game.queries.member(game.state, owner)!.levelUpReady !== ready)
            throw new Error("成長可否が閾値と違う")
          return JSON.stringify(game.save())
        },
        { index, ready }
      )
      const hint = page.locator("[data-stand-level-up]")
      if ((await hint.count()) !== (ready ? 1 : 0))
        throw new Error("成長案内の切替が違う")
      if (ready) {
        await hint.scrollIntoViewIfNeeded()
        if (
          (await hint.innerText()) !== "宿の普通の部屋・高い部屋でレベルアップ"
        )
          throw new Error("成長できる部屋が違う")
        const box = await hint.boundingBox()
        const font = await hint.evaluate((element) =>
          parseFloat(getComputedStyle(element).fontSize)
        )
        if (
          !box ||
          box.x < 0 ||
          box.y < 0 ||
          box.x + box.width > width ||
          box.y + box.height > 760 ||
          font < 11
        )
          throw new Error("成長案内が読めない")
        await page.screenshot({ path: `/tmp/dnd-stand-level-up-${width}.png` })
      }
      if (
        (await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )) !== before
      )
        throw new Error("案内閲覧で保存が変わる")
    }
    await page.evaluate(async () => {
      const runtime = window.__devStudio as StudioRuntime
      const game = runtime.game!
      const saved = game.save()
      const owner = saved.snapshot.gear.find(
        (entry) => entry.id === "preview-find-armor"
      )!.owner!
      const member = game.queries.member(game.state, owner)!
      const issue = game.restore({
        ...saved,
        snapshot: {
          ...saved.snapshot,
          party: saved.snapshot.party.filter((id) => id !== owner),
          members: saved.snapshot.members.map((entry) =>
            entry.id === owner ? { ...entry, exp: member.next } : entry
          ),
        },
      })
      if (issue) throw issue
      await runtime.advance(11500)
    })
    const reserveHint = page.locator("[data-stand-level-up]")
    await reserveHint.scrollIntoViewIfNeeded()
    if (
      !(await reserveHint.innerText()).startsWith(
        `出撃の${PARTY_SLOTS}人に入れて、`
      )
    )
      throw new Error("控えの編成案内がない")
    console.log(
      `${width}: 必要経験値の前後で案内切替・部屋名・可読性・保存保持`
    )
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
