import layers from "@/content/data/layers.json"
import recruits from "@/content/data/recruits.json"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import type { StudioRuntime } from "@/client/dev/studio-runtime"

const mayu = recruits.find((recruit) => recruit.member.slug === "mayu")!
const blessing = (await import("@/content/data/skills.json")).default.find(
  (skill) => skill.slug === "dungeon-blessing-1"
)!
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
      async ({ member, blessing, layer }) => {
        const runtime = window.__devStudio as StudioRuntime
        await runtime.advance(2500)
        const game = runtime.game!
        const saved = game.save()
        const issue = game.restore({
          ...saved,
          snapshot: {
            ...saved.snapshot,
            reached: 4,
            phase: {
              type: "expedition",
              expedition: {
                layer,
                at: "s",
                visited: ["s"],
                events: [],
                pending: null,
                loot: { gold: 0, goods: [] },
                cleared: false,
              },
            },
            members: saved.snapshot.members.map((entry) =>
              entry.id === member ? { ...entry, blessing: blessing.id } : entry
            ),
          },
        })
        if (issue) throw issue
        const commands = game.queries.commands(game.state, member)!
        const shared = commands.blessing!
        if (!shared) throw new Error("祝福がない")
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
        blessing: { id: blessing.id },
        layer: layers[0]!.id,
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
    const detail = page.getByRole("region", { name: "選んだワザの詳細" })
    if (
      !(await detail.innerText()).includes(
        "この探索中だけ有効な祝福。帰還すると消える。"
      )
    )
      throw new Error("祝福の有効期間が分からない")
    await page.screenshot({
      path: `/tmp/dnd-skill-blessing-${viewport.name}.png`,
    })
    const after = await page.evaluate(() =>
      JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
    )
    if (after !== expected.save) throw new Error("閲覧で状態が変わった")
    console.log(`${viewport.name}: 祝福の残り回数・有効期間・保存保持`)
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
