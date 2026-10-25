import goods from "../src/lib/content/data/goods.json"
import recruits from "../src/lib/content/data/recruits.json"
import { BASE_URL, launch, openPage } from "./lib"
import { frameUrl, parseStudioConfig } from "../src/lib/dev/studio/config"
import type { StudioRuntime } from "../src/lib/dev/studio/runtime"

const mayu = recruits.find((recruit) => recruit.member.slug === "mayu")!
const weapon = goods.find((good) => good.slug === "votive-greatsword")!
const browser = await launch()
const errors: string[] = []
try {
  for (const viewport of [
    { name: "small", width: 320, height: 760 },
    { name: "phone", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    const page = await openPage(browser, viewport, errors)
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "stand-2",
            // マユは初期の仲間にいないので、出撃の3人目（stand-2）に入れて開く
            party: ["hero", "alda", mayu.member.slug],
            duration: 15000,
            width: viewport.width,
            height: viewport.height,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    const expected = await page.evaluate(
      async ({ member, weapon }) => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(2500)
        const game = runtime.game!
        const saved = game.save()
        const issue = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            reached: 4,
            gear: [
              ...saved.snapshot.gear,
              {
                id: "duplicate-weapon",
                good: weapon.id,
                owner: null,
                plus: 0,
                progress: 0,
                wear: 0,
                weapon: { rarity: "N", extraPower: 0, skills: weapon.skills },
              },
            ],
          },
        })
        if (issue) throw issue
        const result = game.send({
          type: "equip",
          gear: "duplicate-weapon",
          member,
        })
        if (!Array.isArray(result)) throw new Error(JSON.stringify(result))
        const commands = game.queries.commands(game.state, member)!
        const shared = commands.weaponSkills.find((skill) =>
          commands.skills.some((other) => other.id === skill.id)
        )!
        if (!shared) throw new Error("重複する実際のワザがない")
        await runtime.advance(3500)
        return {
          name: game.queries.member(game.state, member)!.name,
          skill: shared.name,
          left: shared.left,
          uses: shared.uses,
          save: JSON.stringify(game.save()),
        }
      },
      {
        member: mayu.member.id,
        weapon: { id: weapon.id, skills: weapon.skills! },
      }
    )
    await page
      .getByRole("button", { name: "ワザの残りを見る", exact: true })
      .click()
    await page.evaluate(async () => {
      await window.__devStudio!.advance(6500)
    })
    const row = page.getByRole("button", { name: expected.skill, exact: true })
    const count = await row.count()
    if (count !== 1) throw new Error(`${expected.skill}が${count}行表示される`)
    if (
      !(await row.innerText()).includes(
        `残り ${expected.left}/${expected.uses}回`
      )
    )
      throw new Error("共通の回数と表示が違う")
    await row.click()
    await page.evaluate(async () => {
      await window.__devStudio!.advance(7500)
    })
    await page.screenshot({
      path: `/tmp/dnd-skill-duplicates-${viewport.name}.png`,
    })
    const after = await page.evaluate(() =>
      JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
    )
    if (after !== expected.save) throw new Error("閲覧で状態が変わった")
    console.log(
      `${viewport.name}: 武器と本人の共通ワザが1行・共通の残り回数を表示`
    )
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
