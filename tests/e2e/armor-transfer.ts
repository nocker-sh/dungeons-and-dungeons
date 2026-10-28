import assert from "node:assert/strict"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameOf } from "@/content/looks/frame-of"
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
    const page = await openPage(browser, viewport, errors)
    page.setDefaultTimeout(15000)
    await page.goto(
      BASE_URL +
        frameUrl(
          parseStudioConfig({
            scene: "stand-find-armor-1",
            duration: 10000,
            width: viewport.width,
            height: viewport.height,
          })
        )
    )
    await page.waitForFunction(
      () => window.__devStudio?.ready || window.__devStudioError
    )
    const memberId = await page.evaluate(async () => {
      const runtime = window.__devStudio as StudioRuntime
      await runtime.advance(2500)
      const game = runtime.game!
      const hero = game.state.gear.find(
        (gear) => gear.id === "preview-find-armor"
      )!.owner!
      const maxHp = game.queries.member(game.state, hero)!.maxHp
      const saved = game.save()
      const problem = game.restore({
        ...saved,
        snapshot: {
          ...saved.snapshot,
          members: saved.snapshot.members.map((member) =>
            member.id === hero ? { ...member, hp: maxHp } : member
          ),
        },
      })
      if (problem) throw new Error(String(problem))
      await runtime.advance(3000)
      return hero
    })
    await page.getByRole("button", { name: "装備", exact: true }).click()
    await page.evaluate(async () => {
      await window.__devStudio!.advance(4000)
    })
    await page.getByRole("button", { name: "持ち物", exact: true }).click()
    await page.evaluate(async () => {
      await window.__devStudio!.advance(5000)
    })
    // 主人公は防具を着ないので、別の仲間が着ている防具を、この仲間へ付け替える
    const transfer = await page.evaluate((memberId) => {
      const game = (window.__devStudio as StudioRuntime).game!
      const worn = game.queries
        .gear(game.state)
        .find(
          (gear) =>
            gear.kind === "armor" &&
            gear.ownerId &&
            gear.ownerId !== memberId &&
            game.queries
              .equipOptions(game.state, memberId)
              .some((option) => option.gear === gear.gear)
        )
      if (!worn) throw new Error("ほかの仲間が着ている付け替えられる防具がない")
      const comparison = game.queries.armorComparison(
        game.state,
        memberId,
        worn.gear
      )
      const donor = comparison?.previousOwner
      if (!donor) throw new Error("渡す仲間の比較がQueryにない")
      return {
        name: worn.name,
        owner: worn.owner!,
        donorId: donor.id,
        notice: `${donor.name}は防具なしになる：耐久 ${donor.before.durability}/${donor.before.maxDurability} → ${donor.after.durability}/${donor.after.maxDurability}`,
      }
    }, memberId)
    await page
      .getByRole("button", { name: transfer.name, exact: true })
      .filter({ hasText: transfer.owner })
      .first()
      .click()
    await page.evaluate(async () => {
      await window.__devStudio!.advance(6000)
    })
    const details = page.getByRole("region", {
      name: "選んだ品の詳細",
      exact: true,
    })
    const text = await details.innerText()
    if (!text.includes(transfer.notice))
      throw new Error(`渡す仲間の防具喪失が表示されない: ${text}`)
    const donorId = transfer.donorId
    await details.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await page.screenshot({
      path: `/tmp/dnd-armor-transfer-${viewport.name}.png`,
    })
    await page.getByRole("button", { name: "付け替える", exact: true }).click()
    await page.evaluate(async () => {
      await window.__devStudio!.advance(7000)
    })
    const owners = await page.evaluate(
      ({ memberId, donorId }) => {
        const game = (window.__devStudio as StudioRuntime).game!
        return {
          party: game.state.party,
          donor: game.queries.member(game.state, donorId)!,
          recipient: game.queries.member(game.state, memberId)!,
        }
      },
      { memberId, donorId }
    )
    if (owners.donor.gear.some((gear) => gear.slot === "armor"))
      throw new Error("渡す側の防具が残っている")
    for (const member of [owners.donor, owners.recipient]) {
      const frame = frameOf(member.look, member.armor?.good)
      const image = page
        .locator(".formation .card img")
        .nth(owners.party.indexOf(member.id))
      const source = await image.getAttribute("src")
      assert.ok(source)
      assert.ok(
        [frame.img, frame.bust].includes(source),
        `${member.name}の立ち絵に付け替え後の防具を反映する`
      )
      assert.ok(
        await image.evaluate(
          (element) =>
            (element as HTMLImageElement).complete &&
            (element as HTMLImageElement).naturalWidth > 0
        )
      )
    }
    console.log(
      `${viewport.name}: 渡す仲間が防具なしになる比較と付け替えを確認`
    )
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
