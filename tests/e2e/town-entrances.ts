import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { BASE_URL } from "@/tests/e2e/lib"
import { launch } from "@/tests/e2e/launch"
import { openPage } from "@/tests/e2e/open-page"
import { press } from "@/tests/e2e/press"
import type { Page } from "playwright"

const directory = "/tmp/product-test/visual/town-entrances"
await mkdir(directory, { recursive: true })

async function inspectEntrances(page: Page) {
  return page.locator("[data-entrance]").evaluateAll((buttons) =>
    buttons.map((button) => {
      const image = button.closest(".layer")!.querySelector("img")!
      const layer = image.parentElement!
      const scale = Math.max(
        layer.clientWidth / image.naturalWidth,
        layer.clientHeight / image.naturalHeight
      )
      // 背景画像自体から求めた入口に測定点を置く。吹き出し側の配置値は使わない。
      const probe = document.createElement("span")
      probe.style.cssText =
        "position:absolute;width:0;height:0;pointer-events:none"
      probe.style.left = `${(layer.clientWidth - image.naturalWidth * scale) / 2 + Number(button.dataset.anchorX) * image.naturalWidth * scale}px`
      probe.style.top = `${(layer.clientHeight - image.naturalHeight * scale) / 2 + Number(button.dataset.anchorY) * image.naturalHeight * scale}px`
      layer.append(probe)
      const expected = probe.getBoundingClientRect()
      const tip = button.querySelector<SVGCircleElement>("[data-entrance-tip]")!
      const actual = new DOMPoint(
        tip.cx.baseVal.value,
        tip.cy.baseVal.value
      ).matrixTransform(tip.getScreenCTM()!)
      const rect = button.getBoundingClientRect()
      const viewport = document
        .querySelector(".canvas")!
        .getBoundingClientRect()
      probe.remove()
      return {
        label: button.getAttribute("aria-label"),
        distance: Math.hypot(actual.x - expected.x, actual.y - expected.y),
        rect: rect.toJSON(),
        viewport: viewport.toJSON(),
        image: image.getAttribute("src"),
        loaded: image.naturalWidth > 0,
      }
    })
  )
}

const browser = await launch()
try {
  for (const viewport of [
    { name: "phone", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 800 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "small", width: 320, height: 568 },
    { name: "landscape", width: 844, height: 390 },
  ]) {
    const errors: string[] = []
    const page = await openPage(browser, viewport, errors)
    await page.goto(`${BASE_URL}/previews/town`)
    const dungeon = page.getByRole("button", {
      name: "ダンジョン",
      exact: true,
    })
    await dungeon.waitFor()
    await page.waitForTimeout(900)
    for (const pointer of [
      { x: 5, y: 5 },
      { x: viewport.width - 5, y: viewport.height / 2 },
    ]) {
      await page.mouse.move(pointer.x, pointer.y)
      await page.waitForTimeout(500)
      const entrances = await inspectEntrances(page)
      assert.equal(entrances.length, 3)
      for (const entrance of entrances) {
        assert.ok(entrance.loaded)
        assert.ok(
          entrance.distance < 1,
          `${viewport.name}/${entrance.label}: 入口と先端がずれた ${entrance.distance}px`
        )
        assert.ok(
          entrance.rect.x >= 0 && entrance.rect.right <= viewport.width,
          `${entrance.label}: 横にはみ出した`
        )
        assert.ok(
          entrance.rect.y >= 0 &&
            entrance.rect.bottom <= entrance.viewport.bottom,
          `${entrance.label}: 縦にはみ出した`
        )
        assert.ok(entrance.rect.width >= 44 && entrance.rect.height >= 44)
      }
      // ダンジョンは奥の門の吹き出し。右下の大きなボタンは廃止した
      assert.equal(await dungeon.getAttribute("data-entrance"), "dungeon")
      for (const [index, entrance] of entrances.entries())
        for (const other of entrances.slice(index + 1))
          assert.ok(
            entrance.rect.right <= other.rect.x ||
              entrance.rect.x >= other.rect.right ||
              entrance.rect.bottom <= other.rect.y ||
              entrance.rect.y >= other.rect.bottom,
            `${viewport.name}: ${entrance.label}と${other.label}が重なった`
          )
    }
    await page.screenshot({ path: `${directory}/${viewport.name}.png` })
    if (viewport.name === "phone" || viewport.name === "desktop") {
      // 行き先の場所にも入口の吹き出しはあるので、街の入口が残らないことを id で見る
      const townEntrances = await page
        .locator("[data-entrance]")
        .evaluateAll((elements) =>
          elements.map(
            (element) =>
              `[data-entrance="${element.getAttribute("data-entrance")}"]`
          )
        )
      assert.equal(townEntrances.length, 3)
      for (const [entrance, destination] of [
        ["冒険者ギルド", "受付"],
        ["ダンジョン", "カチコミ"],
        ["商店街", "武器と防具"],
        ["ダンジョン", "カチコミ"],
      ]) {
        await press(page, entrance)
        await page
          .getByRole("button", { name: destination, exact: true })
          .waitFor()
        assert.equal(await page.locator(townEntrances.join(",")).count(), 0)
        await press(page, entrance === "ダンジョン" ? "‹ 街へ" : "‹ 戻る")
        await dungeon.waitFor()
      }
      await press(page, "バッグ")
      await page.getByRole("button", { name: "閉じる", exact: true }).waitFor()
      await press(page, "閉じる")
      await page.waitForTimeout(500)
      // 背景と入口の対応は画面の縦横を変えても保つ。
      await page.setViewportSize(
        viewport.name === "phone"
          ? { width: 1280, height: 800 }
          : { width: 390, height: 844 }
      )
      await page.waitForTimeout(900)
      const resized = await inspectEntrances(page)
      assert.equal(resized.length, 3)
      assert.ok(resized.every((entrance) => entrance.distance < 1))
      assert.ok(
        resized.every((entrance) =>
          entrance.image?.includes(
            viewport.name === "phone"
              ? "town-market-ink-wide.webp"
              : "town-market-ink.webp"
          )
        )
      )
      // 吹き出しはキーボードでも押せる
      await dungeon.focus()
      await page.keyboard.press("Enter")
      await page
        .locator("[data-entrance]")
        .first()
        .waitFor({ state: "detached" })
      await page
        .getByRole("button", {
          name: "カチコミ",
          exact: true,
        })
        .waitFor()
    }
    assert.deepEqual(errors, [])
    console.log(`${viewport.name}: 背景と入口の追従・画面内配置・施設移動 OK`)
    await page.close()
  }
} finally {
  await browser.close()
}
