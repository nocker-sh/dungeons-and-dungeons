import { BASE_URL, launch, openPage } from "./lib"
import conversations from "../src/lib/content/data/conversations.json"
import type { Page } from "playwright"

const browser = await launch()
const errors: string[] = []

async function installPad(page: Page) {
  await page.evaluate(() => {
    const pad = {
      index: 0,
      buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
      axes: [0, 0],
    }
    Object.assign(window, { conversationTestPad: pad })
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [pad],
    })
  })
  return async (index: number) => {
    const toggle = async (pressed: boolean) => {
      await page.evaluate(
        ({ index, pressed }) => {
          const pad = (
            window as unknown as {
              conversationTestPad: { buttons: { pressed: boolean }[] }
            }
          ).conversationTestPad
          pad.buttons[index].pressed = pressed
        },
        { index, pressed }
      )
      await page.waitForTimeout(120)
    }
    await toggle(true)
    await toggle(false)
  }
}

try {
  for (const viewport of [
    { name: "small", width: 320, height: 760 },
    { name: "phone", width: 390, height: 844 },
    { name: "desktop", width: 1280, height: 900 },
  ]) {
    const page = await openPage(browser, viewport, errors)
    page.setDefaultTimeout(15000)
    await page.goto(`${BASE_URL}/previews/route-loot-rare?still`)
    await page.getByRole("button", { name: "OK", exact: true }).click()
    const talk = page.getByRole("button", { name: "会話を進める", exact: true })
    const dialog = page.locator('[role="dialog"][aria-modal="true"]')
    await talk.waitFor()
    await page.waitForTimeout(1600)
    for (const key of [
      "1",
      "2",
      "3",
      "4",
      "Tab",
      "Shift+Tab",
      "Escape",
      "ArrowLeft",
    ]) {
      await page.keyboard.press(key)
      if (await page.locator(".stand").count())
        throw new Error(`${key}で背面の仲間が開く`)
      if (
        !(await dialog.evaluate((element) =>
          element.contains(document.activeElement)
        ))
      )
        throw new Error(`${key}でフォーカスが会話から漏れる`)
    }
    const pad = await installPad(page)
    for (const direction of [12, 13, 14, 15, 1]) await pad(direction)
    if (!(await dialog.count())) throw new Error("方向キー・Bで会話が閉じる")
    await page.waitForTimeout(1600)
    await page.screenshot({
      path: `/tmp/dnd-conversation-input-${viewport.name}.png`,
    })
    // Aは1押しで1行進む。拾い物の台本の行数ぶん押すと閉じて探索へ戻る
    const lootId = await page
      .locator("[data-conversation-id]")
      .getAttribute("data-conversation-id")
    const loot = conversations.find((entry) => entry.id === lootId)
    if (!loot) throw new Error(`拾い物の台本がない: ${lootId}`)
    if (loot.choice) throw new Error("拾い物の台本に選択肢がある")
    for (let index = 0; index < loot.lines.length; index++) {
      await page.waitForFunction(
        (text) =>
          document
            .querySelector(
              '[aria-label="会話を進める"][data-conversation-ready]'
            )
            ?.textContent?.includes(text),
        loot.lines[index].text
      )
      await pad(0)
    }
    await dialog.waitFor({ state: "hidden" })
    await page.getByRole("button", { name: "進む", exact: true }).waitFor()
    console.log(
      `${viewport.name}: 数字・Tab・方向キー・Esc/Bの背面操作を防ぎ、Aで探索に復帰`
    )

    const script = conversations.find((entry) => entry.id === "alda-mayu-inn")!
    await page.goto(`${BASE_URL}/previews/conversations?id=${script.id}`)
    await talk.waitFor()
    for (let index = 0; index < script.lines.length; index++) {
      await page.waitForFunction(
        (text) =>
          document
            .querySelector(
              '[aria-label="会話を進める"][data-conversation-ready]'
            )
            ?.textContent?.includes(text),
        script.lines[index].text,
        { timeout: 15000 }
      )
      if (!(await talk.textContent())?.includes(script.lines[index].text))
        throw new Error(`複数行の会話が${index}行目を飛ばした`)
      await page.keyboard.press(["Enter", "Space", "ArrowRight"][index % 3])
    }
    await talk.waitFor({ state: "hidden" })
    console.log(
      `${viewport.name}: Enter・Space・右キーで一行ずつ進み、最後に終了`
    )

    await page.goto(`${BASE_URL}/previews/room-attic?still`)
    await page.getByRole("button", { name: "泊まる", exact: true }).click()
    await page.getByRole("button", { name: "雑談する", exact: true }).click()
    await talk.waitFor()
    // 雑談の台本の選択肢（答えの札の並び）。選んでいる答えはアクティブ（is-active）の札
    const chatId = await page
      .locator("[data-conversation-id]")
      .getAttribute("data-conversation-id")
    const chat = conversations.find((entry) => entry.id === chatId)
    if (!chat?.choice) throw new Error(`雑談の台本に選択肢がない: ${chatId}`)
    const choices = page.getByRole("group", {
      name: chat.choice.ask,
      exact: true,
    })
    for (let step = 0; step < 24 && !(await choices.count()); step++) {
      await page.waitForTimeout(1100)
      await page.keyboard.press("Enter")
    }
    await choices.waitFor()
    await page.waitForTimeout(700)
    const focused = (index: number) =>
      choices
        .getByRole("button")
        .nth(index)
        .evaluate((element) => element.classList.contains("is-active"))
    if (!(await focused(0))) throw new Error("選択肢の最初の答えを選んでいない")
    await page.keyboard.press("ArrowDown")
    if (!(await focused(1))) throw new Error("会話の選択肢が下キーで変わらない")
    const roomPad = await installPad(page)
    await roomPad(12)
    if (!(await focused(0)))
      throw new Error("会話の選択肢がコントローラーの上で戻らない")
    await roomPad(13)
    if (!(await focused(1)))
      throw new Error("会話の選択肢がコントローラーの下で変わらない")
    await roomPad(0)
    await choices.waitFor({ state: "hidden" })
    if (!(await talk.isEnabled())) throw new Error("選択後の返事へ進めない")
    // 2つ目の答えの返事が出る
    const reply = chat.choice.options[1].lines[0].text
    await page.waitForFunction(
      (text) =>
        document
          .querySelector('[aria-label="会話を進める"]')
          ?.textContent?.includes(text),
      reply
    )
    for (
      let step = 0;
      step < chat.choice.options[1].lines.length + 2 && (await dialog.count());
      step++
    ) {
      await page.waitForTimeout(1200)
      await page.keyboard.press("Enter")
    }
    await dialog.waitFor({ state: "hidden" })
    if (await page.locator(".stand").count())
      throw new Error("会話終了後に背面の仲間が開いた")
    console.log(
      `${viewport.name}: 宿の選択肢をキー/十字キーで選び、Aで決定、返事と終了まで確認`
    )
    await page.close()
  }
  if (errors.length) throw new Error(errors.join("\n"))
} finally {
  await browser.close()
}
