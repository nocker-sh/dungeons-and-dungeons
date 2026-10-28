import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { frameUrl } from "@/development/studio/frame-url"
import { parseStudioConfig } from "@/development/studio/parse-studio-config"
import goods from "@/content/data/goods.json"
import shops from "@/content/data/shops.json"
import type { StudioRuntime } from "@/client/dev/studio-runtime"

const browser = await launch()
const errors: string[] = []
try {
  for (const viewport of [
    { name: "small", width: 320, height: 760 },
    { name: "phone", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    for (const kind of ["weapon", "armor"] as const) {
      const page = await openPage(browser, viewport, errors)
      await page.goto(
        BASE_URL +
          frameUrl(
            parseStudioConfig({
              scene: "bag",
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
        async (candidate) => {
          const runtime = window.__devStudio as StudioRuntime
          await runtime.advance(2500)
          const game = runtime.game!
          const saved = game.save()
          const issue = game.restore({
            ...saved,
            snapshot: {
              ...saved.snapshot,
              gold: 100000,
              phase: { type: "town" },
            },
          })
          if (issue) throw issue
          const bought = game.send({
            type: "buy",
            shop: candidate.shop,
            good: candidate.good,
          })
          if (!Array.isArray(bought)) throw new Error("装備を購入できない")
          if (candidate.withCurrent) {
            const first = game.queries
              .gear(game.state)
              .find((entry) => entry.id === candidate.good && !entry.ownerId)!
            if (
              !Array.isArray(
                game.send({
                  type: "equip",
                  gear: first.gear,
                  member: game.state.party[0],
                })
              )
            )
              throw new Error("現在の武器を装備できない")
            if (
              !Array.isArray(
                game.send({
                  type: "buy",
                  shop: candidate.shop,
                  good: candidate.good,
                })
              )
            )
              throw new Error("比較する武器を購入できない")
          }
          const original = game.queries
            .gear(game.state)
            .find((entry) => entry.id === candidate.good && !entry.ownerId)!
          if (!original) throw new Error("購入した装備がない")
          const id = original.gear
          await runtime.advance(3500)
          const eligible = game.state.party.filter((member) =>
            game.queries
              .equipOptions(game.state, member)
              .some((entry) => entry.gear === id)
          )
          if (!eligible.length) throw new Error("装備できる仲間がいない")
          const target = eligible[0]
          const currentWeapon = game.queries.weapon(
            game.state,
            game.state.members.find((member) => member.id === target)!
          )
          const comparison = original.armor
            ? game.queries.armorComparison(game.state, target, id)!
            : null
          const fit = original.weapon
            ? game.queries.weaponFit(
                game.state,
                target,
                original.id,
                original.plus,
                original.weapon.extraPower
              )!
            : null
          return {
            id,
            name: original.name,
            target,
            eligible,
            eligibleNames: eligible.map(
              (member) => game.queries.member(game.state, member)!.name
            ),
            comparison,
            fit,
            currentAttack: currentWeapon?.attack ?? null,
            save: JSON.stringify(game.save()),
          }
        },
        (() => {
          for (const shop of shops) {
            const good = shop.goods
              .map((id) => goods.find((good) => good.id === id))
              .find((good) => good?.kind === kind)
            if (good)
              return {
                shop: shop.id,
                good: good.id,
                withCurrent: kind === "weapon" && viewport.name !== "small",
              }
          }
          throw new Error("店売りの装備がない")
        })()
      )
      await page.getByRole("button", { name: "装備", exact: true }).click()
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).advance(4000)
      )
      await page
        .getByRole("button", { name: expected.name, exact: true })
        .last()
        .click()
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).advance(4500)
      )
      const equipmentDetails = page.getByRole("region", {
        name: "選んだ品の詳細",
        exact: true,
      })
      if (kind === "armor") {
        const repair = await page.evaluate(async (id) => {
          const runtime = window.__devStudio as StudioRuntime
          const game = runtime.game!
          const saved = game.save()
          const issue = game.restore({
            ...saved,
            snapshot: {
              ...saved.snapshot,
              gear: saved.snapshot.gear.map((entry) =>
                entry.id === id ? { ...entry, wear: 1 } : entry
              ),
            },
          })
          if (issue) throw issue
          await runtime.advance(4750)
          return game.queries
            .gear(game.state)
            .find((entry) => entry.gear === id)!.armor!.gold
        }, expected.id)
        if (
          !(await equipmentDetails.innerText()).includes(
            `鍛冶屋で修理：${repair}G（耐久を満タンに戻す）`
          )
        )
          throw new Error("消耗防具の修理案内がQueryと違う")
        if (
          !(await equipmentDetails.innerText()).includes(
            "修理するには、街で仲間に装備してから鍛冶屋へ。"
          )
        )
          throw new Error("未装備防具の修理手順がない")
        if ((await equipmentDetails.innerText()).includes("耐久切れ："))
          throw new Error("耐久が残る防具へ耐久切れを表示")
        await page.evaluate(async (id) => {
          const runtime = window.__devStudio as StudioRuntime
          const game = runtime.game!
          const armor = game.queries
            .gear(game.state)
            .find((entry) => entry.gear === id)!.armor!
          const saved = game.save()
          const issue = game.restore({
            ...saved,
            snapshot: {
              ...saved.snapshot,
              gear: saved.snapshot.gear.map((entry) =>
                entry.id === id
                  ? { ...entry, wear: armor.maxDurability }
                  : entry
              ),
            },
          })
          if (issue) throw issue
          await runtime.advance(4800)
        }, expected.id)
        if (
          !(await equipmentDetails.innerText()).includes(
            "耐久切れ：ダメージを防げません。"
          )
        )
          throw new Error("耐久切れ防具の案内がない")
        await equipmentDetails.evaluate((element) => {
          element.scrollTop = element.scrollHeight
        })
        await page.screenshot({
          path: `/tmp/dnd-bag-repair-${viewport.name}.png`,
        })
        await page.evaluate(async (id) => {
          const runtime = window.__devStudio as StudioRuntime
          const saved = runtime.game!.save()
          const issue = runtime.game!.restore({
            ...saved,
            snapshot: {
              ...saved.snapshot,
              gear: saved.snapshot.gear.map((entry) =>
                entry.id === id ? { ...entry, wear: 0 } : entry
              ),
            },
          })
          if (issue) throw issue
          await runtime.advance(4900)
        }, expected.id)
        if ((await equipmentDetails.innerText()).includes("鍛冶屋で修理："))
          throw new Error("満タンの防具に修理案内が残る")
        if ((await equipmentDetails.innerText()).includes("耐久切れ："))
          throw new Error("満タンの防具に耐久切れが残る")
      }
      const expectedTargets = `変更できる仲間：${expected.eligibleNames.join("・")}`
      if (!(await equipmentDetails.innerText()).includes(expectedTargets))
        throw new Error("装備変更できる仲間の案内がQueryと違う")
      await equipmentDetails.evaluate((element) => {
        element.scrollTop = element.scrollHeight
      })
      await page.screenshot({
        path: `/tmp/dnd-bag-equipment-targets-${viewport.name}-${kind}.png`,
      })
      await page
        .getByRole("button", { name: "仲間に装備", exact: true })
        .click()
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).advance(5000)
      )
      const details = page.getByRole("region", {
        name: "装備後の比較",
        exact: true,
      })
      if (!(await details.isVisible())) throw new Error("装備前の比較がない")
      const text = await details.innerText()
      if (text.includes("着替え後は耐久切れ："))
        throw new Error("満タン装備の比較に耐久切れ警告")
      if (
        expected.fit &&
        !text.includes(
          expected.currentAttack !== null
            ? `攻撃力 ${expected.currentAttack} → ${expected.fit.attack}`
            : `現在は武器なし。装備後の攻撃力 ${expected.fit.attack}`
        )
      )
        throw new Error("武器の予告が違う")
      if (
        expected.comparison &&
        !text.includes(
          `耐久 ${expected.comparison.before.durability}/${expected.comparison.before.maxDurability} → ${expected.comparison.after.durability}/${expected.comparison.after.maxDurability}`
        )
      )
        throw new Error("防具の予告が違う")
      if (expected.comparison) {
        const { before, after } = expected.comparison
        const hpText = `現在HP（生命力） ${before.hp}/${before.maxHp} → ${after.hp}/${after.maxHp}`
        const changed = before.hp !== after.hp || before.maxHp !== after.maxHp
        if (text.includes(hpText) !== changed)
          throw new Error("防具比較のHP変化表示が違う")
      }
      if (
        (await page.locator(".card .aim").count()) !== expected.eligible.length
      )
        throw new Error("対象が装備ルールと違う")
      await page.keyboard.press("Escape")
      if (
        (await page.evaluate(() =>
          JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
        )) !== expected.save
      )
        throw new Error("取消で保存が変わる")
      await page
        .getByRole("button", { name: "仲間に装備", exact: true })
        .click()
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).advance(5500)
      )
      await page.screenshot({
        path: `/tmp/dnd-bag-equipment-${viewport.name}-${kind}.png`,
      })
      await page
        .locator(
          `.card .hit[aria-describedby="target-detail-${expected.target}"]`
        )
        .click()
      await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).advance(6500)
      )
      const after = await page.evaluate(() =>
        (window.__devStudio as StudioRuntime).game!.save()
      )
      if (
        after.snapshot.gear.find((gear) => gear.id === expected.id)?.owner !==
        expected.target
      )
        throw new Error("対象へ装備されない")
      const actual = await page.evaluate((target) => {
        const game = (window.__devStudio as StudioRuntime).game!
        const member = game.state.members.find(
          (member) => member.id === target
        )!
        return {
          weapon: game.queries.weapon(game.state, member),
          armor: game.queries.armor(game.state, member),
          member: game.queries.member(game.state, target)!,
        }
      }, expected.target)
      if (expected.fit && actual.weapon?.attack !== expected.fit.attack)
        throw new Error("装備後の攻撃力が予告と違う")
      if (
        expected.comparison &&
        (actual.armor?.durability !== expected.comparison.after.durability ||
          actual.member.maxHp !== expected.comparison.after.maxHp)
      )
        throw new Error("着替え後の耐久・能力が予告と違う")
      const before = JSON.parse(expected.save)
      if (
        after.snapshot.gold !== before.snapshot.gold ||
        JSON.stringify(after.snapshot.bag) !==
          JSON.stringify(before.snapshot.bag)
      )
        throw new Error("装備で金貨や所持品が変わる")
      if (kind === "weapon") {
        const owner = await page.evaluate((id) => {
          const game = (window.__devStudio as StudioRuntime).game!
          return game.queries
            .gear(game.state)
            .find((entry) => entry.gear === id)!.owner!
        }, expected.id)
        await page
          .getByRole("button", { name: "仲間に装備", exact: true })
          .click()
        await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).advance(7000)
        )
        if (
          !(await details.innerText()).includes(
            `${owner}から受け取る（${owner}は武器なしになる）`
          )
        )
          throw new Error("渡す仲間の武器が外れることが分からない")
        await page.keyboard.press("Escape")
        if (
          (await page.evaluate(() =>
            JSON.stringify((window.__devStudio as StudioRuntime).game!.save())
          )) !== JSON.stringify(after)
        )
          throw new Error("受け渡しの取消で装備が変わる")
        const receiver = await page.evaluate((id) => {
          const game = (window.__devStudio as StudioRuntime).game!
          const gear = game.queries
            .gear(game.state)
            .find((entry) => entry.gear === id)!
          const member = game.state.party.find((member) =>
            game.queries
              .equipOptions(game.state, member)
              .some((entry) => entry.gear === id)
          )!
          if (!member || !gear.weapon) throw new Error("受け渡し先がない")
          return {
            member,
            attack: game.queries.weaponFit(
              game.state,
              member,
              gear.id,
              gear.plus,
              gear.weapon.extraPower
            )!.attack,
          }
        }, expected.id)
        await page
          .getByRole("button", { name: "仲間に装備", exact: true })
          .click()
        await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).advance(7500)
        )
        await page
          .locator(
            `.card .hit[aria-describedby="target-detail-${receiver.member}"]`
          )
          .click()
        await page.evaluate(() =>
          (window.__devStudio as StudioRuntime).advance(8000)
        )
        const transferred = await page.evaluate(
          ({ id, previous, receiver }) => {
            const game = (window.__devStudio as StudioRuntime).game!
            const member = game.state.members.find(
              (member) => member.id === receiver
            )!
            return {
              save: game.save(),
              owner: game.state.gear.find((gear) => gear.id === id)!.owner,
              previousHasWeapon: game.queries
                .gear(game.state)
                .some(
                  (gear) => gear.ownerId === previous && gear.slot === "weapon"
                ),
              attack: game.queries.weapon(game.state, member)!.attack,
            }
          },
          {
            id: expected.id,
            previous: expected.target,
            receiver: receiver.member,
          }
        )
        if (
          transferred.owner !== receiver.member ||
          transferred.previousHasWeapon ||
          transferred.attack !== receiver.attack
        )
          throw new Error("受け渡しの結果が予告と違う")
        if (
          transferred.save.snapshot.gold !== after.snapshot.gold ||
          JSON.stringify(transferred.save.snapshot.bag) !==
            JSON.stringify(after.snapshot.bag)
        )
          throw new Error("受け渡しで資産が変わる")
      }
      await page.evaluate(() => {
        const game = (window.__devStudio as StudioRuntime).game!
        const result = game.send({
          type: "depart",
          layer: game.queries.defaultDestination(game.state),
        })
        if (!Array.isArray(result)) throw new Error("出撃できない")
      })
      if (
        await page
          .getByRole("button", { name: "仲間に装備", exact: true })
          .count()
      )
        throw new Error("探索中も装備変更できる表示になる")
      const expeditionDetail = page.getByRole("region", {
        name: "選んだ品の詳細",
        exact: true,
      })
      await expeditionDetail.evaluate((node) => {
        node.scrollTop = node.scrollHeight
      })
      if (
        !(await expeditionDetail.evaluate((node) => {
          const text = "装備の変更は街でできます。"
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
          while (walker.nextNode()) {
            const current = walker.currentNode
            const offset = current.textContent?.indexOf(text) ?? -1
            if (offset < 0) continue
            if (
              !current.parentElement ||
              parseFloat(getComputedStyle(current.parentElement).fontSize) < 11
            )
              return false
            const range = document.createRange()
            range.setStart(current, offset)
            range.setEnd(current, offset + text.length)
            const bounds = range.getBoundingClientRect()
            const region = node.getBoundingClientRect()
            return bounds.top >= region.top && bounds.bottom <= region.bottom
          }
          return false
        }))
      )
        throw new Error("探索中に装備できない理由がない")
      await page.screenshot({
        path: `/tmp/dnd-bag-equipment-town-only-${viewport.name}-${kind}.png`,
      })
      await page.evaluate(
        async ({ id, kind }) => {
          const runtime = window.__devStudio as StudioRuntime
          const game = runtime.game!
          const saved = game.save()
          // 編成には主人公が必ず入る。武器は主人公に持たせ、主人公だけの編成にする。
          // 主人公は防具を着ないので、防具は着ている仲間と主人公だけの編成にする
          const hero = saved.snapshot.party.find(
            (member) => game.queries.member(game.state, member)?.hero
          )
          if (!hero) throw new Error("編成に主人公がいない")
          const owner =
            kind === "weapon"
              ? hero
              : saved.snapshot.gear.find((entry) => entry.id === id)?.owner
          if (!owner) throw new Error("装備中の持ち主がいない")
          const issue = game.restore({
            ...saved,
            snapshot: {
              ...saved.snapshot,
              phase: { type: "town" },
            },
          })
          if (issue) throw issue
          if (
            game.state.gear.find((entry) => entry.id === id)?.owner !== owner
          ) {
            if (
              !Array.isArray(
                game.send({ type: "equip", gear: id, member: owner })
              )
            )
              throw new Error("主人公へ武器を持たせられない")
          }
          const equipped = game.save()
          const narrowed = game.restore({
            ...equipped,
            snapshot: {
              ...equipped.snapshot,
              party: [...new Set([hero, owner])],
            },
          })
          if (narrowed) throw narrowed
          if (
            game.state.party.some((member) =>
              game.queries
                .equipOptions(game.state, member)
                .some((entry) => entry.gear === id)
            )
          )
            throw new Error("既に装備中の個体か着られない仲間を変更対象にした")
          await runtime.advance(12000)
        },
        { id: expected.id, kind }
      )
      if (
        !(await equipmentDetails.innerText()).includes(
          "今の編成に、この装備へ変更できる仲間はいません。"
        )
      )
        throw new Error("変更対象がいない説明がない")
      if (
        await page
          .getByRole("button", { name: "仲間に装備", exact: true })
          .count()
      )
        throw new Error("変更対象がいないのに装備操作がある")
      console.log(
        `${viewport.name}/${kind}: 比較・無料取消・装備・探索中の制限を確認`
      )
      await page.close()
    }
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
