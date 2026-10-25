import demons from "../src/lib/content/data/demons.json"
import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"

const demon = demons.find((entry) => entry.slug === "zaza")!
const browser = await launch()
const errors: string[] = []
try {
  for (const viewport of [
    { name: "small", width: 320, height: 760 },
    { name: "phone", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    for (const enough of [false, true]) {
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
      const expected = await page.evaluate(
        async ({ demon, enough }) => {
          const runtime = window.__devStudio as StudioRuntime
          await runtime.advance(2500)
          const game = runtime.game!
          const saved = game.save()
          const hero = saved.snapshot.party[0]
          const owned = saved.snapshot.demons.some(
            (entry) => entry.id === demon
          )
          const problem = game.restore({
            ...saved,
            snapshot: {
              ...saved.snapshot,
              demons: owned
                ? saved.snapshot.demons
                : [...saved.snapshot.demons, { id: demon, lv: 1, exp: 0 }],
              contract: demon,
              members: saved.snapshot.members.map((member) =>
                member.id === hero ? { ...member, used: [] } : member
              ),
            },
          })
          if (problem) throw problem
          const skill = game.queries
            .commands(game.state, hero)!
            .skills.find((skill) => skill.cost > 0)!
          if (!skill) throw new Error("HP消費ワザがない")
          const next = game.save()
          const issue = game.restore({
            ...next,
            snapshot: {
              ...next.snapshot,
              members: next.snapshot.members.map((member) =>
                member.id === hero
                  ? { ...member, hp: skill.cost + (enough ? 1 : 0) }
                  : member
              ),
            },
          })
          if (issue) throw issue
          await runtime.advance(3000)
          const actual = game.queries
            .commands(game.state, hero)!
            .skills.find((entry) => entry.id === skill.id)!
          if (actual.usable !== enough)
            throw new Error("使用可能の境界が想定と違う")
          return {
            name: actual.name,
            cost: actual.cost,
            save: JSON.stringify(game.save()),
          }
        },
        { demon: demon.id, enough }
      )
      await page
        .getByRole("button", { name: "ワザの残りを見る", exact: true })
        .click()
      await page.evaluate(async () => {
        await window.__devStudio!.advance(4000)
      })
      await page
        .getByRole("button", { name: expected.name, exact: true })
        .click()
      await page.evaluate(async () => {
        await window.__devStudio!.advance(5000)
      })
      const detail = page.getByRole("region", {
        name: "選んだワザの詳細",
        exact: true,
      })
      const text = await detail.innerText()
      if (!text.includes(`使用時にHP（生命力） ${expected.cost}を消費`))
        throw new Error("HPの消費量がない")
      if (text.includes("HPが足りず使えない") === enough)
        throw new Error("HP不足の案内が使用可否と違う")
      const after = await page.evaluate(() =>
        JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
      )
      if (after !== expected.save) throw new Error("閲覧で状態が変わった")
      await page.screenshot({
        path: `/tmp/dnd-skill-hp-${viewport.name}-${enough ? "enough" : "short"}.png`,
      })
      console.log(
        `${viewport.name} ${enough ? "使用可能" : "HP不足"}: HP消費${expected.cost}・使用可否と案内の一致`
      )
      await page.close()
    }
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
