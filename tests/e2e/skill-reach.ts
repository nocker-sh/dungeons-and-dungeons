import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"

const browser = await launch()
const errors: string[] = []
try {
  for (const viewport of [
    { name: "small", width: 320, height: 760 },
    { name: "phone", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    for (const back of [false, true]) {
      const page = await openPage(browser, viewport, errors)
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: "stand",
              duration: 10000,
              width: viewport.width,
              height: viewport.height,
            })
          )
      )
      await page.waitForFunction(
        () => window.__devStudio?.ready || window.__devStudioError
      )
      const expected = await page.evaluate(async (back) => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(2500)
        const game = runtime.game!
        const member = game.state.party[0]
        const saved = game.save()
        const others = saved.snapshot.party.filter((id) => id !== member)
        const party = back
          ? [...others, member]
          : [others[0], member, ...others.slice(1)]
        const issue = game.restore({
          ...saved,
          snapshot: { ...saved.snapshot, party },
        })
        if (issue) throw issue
        const commands = game.queries.commands(game.state, member)!
        const skills = ["melee", "ranged"].map((reach) => {
          const skill = [...commands.weaponSkills, ...commands.skills].find(
            (skill) => skill.kind === "hit" && skill.reach === reach
          )!
          if (!skill) throw new Error(`${reach}のワザがない`)
          if (skill.weak !== (back && reach === "melee"))
            throw new Error("本体の前後衛判定が想定と違う")
          return { name: skill.name, reach, weak: skill.weak }
        })
        await runtime.advance(3000)
        return { skills, save: JSON.stringify(game.save()) }
      }, back)
      await page
        .getByRole("button", { name: "ワザの残りを見る", exact: true })
        .click()
      await page.evaluate(async () => {
        await window.__devStudio!.advance(4000)
      })
      for (const [index, skill] of expected.skills.entries()) {
        await page
          .getByRole("button", { name: skill.name, exact: true })
          .click()
        await page.evaluate(
          async (time) => {
            await window.__devStudio!.advance(time)
          },
          5000 + index * 1000
        )
        const detail = page.getByRole("region", {
          name: "選んだワザの詳細",
          exact: true,
        })
        const selected = page.getByRole("button", {
          name: skill.name,
          exact: true,
        })
        if ((await selected.getAttribute("aria-pressed")) !== "true")
          throw new Error("選択したワザが読み上げで判別できない")
        if (
          (await page
            .locator("button[data-row-key][aria-pressed=true]")
            .count()) !== 1
        )
          throw new Error("選択表示が複数ある")
        const description = detail
          .locator("span")
          .filter({ hasText: "射程：" })
          .last()
        if (
          (await description.evaluate(
            (node) => getComputedStyle(node).whiteSpace
          )) !== "pre-line"
        )
          throw new Error("詳細の改行が保持されない")
        const text = await detail.innerText()
        const reach = skill.reach === "melee" ? "近接" : "遠距離"
        if (!text.includes(`射程：${reach}`))
          throw new Error("射程が表示されない")
        if (text.includes("後衛からの近接：与える被害が減る") !== skill.weak)
          throw new Error("減衰の案内が本体と違う")
        const after = await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )
        if (after !== expected.save) throw new Error("閲覧で状態が変わった")
        await page.screenshot({
          path: `/tmp/dnd-skill-reach-${viewport.name}-${back ? "back" : "front"}-${skill.reach}.png`,
        })
        console.log(
          `${viewport.name} ${back ? "後衛" : "前衛"}: ${reach}の射程と減衰の有無が本体と一致`
        )
      }
      await page.close()
    }
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
