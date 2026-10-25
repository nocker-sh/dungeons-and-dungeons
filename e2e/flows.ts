/// <reference types="node" />
/**
 * 操作の確認。押せるべき所が押せ、流れが最後まで進むかを確かめる。
 *   bun e2e/flows.ts            すべて
 *   bun e2e/flows.ts bag battle 名前で絞る
 */
import type { Page } from "playwright"
import {
  FIRE,
  fire,
  BASE_URL,
  VIEWPORTS,
  labels,
  launch,
  openPage,
  openPreview,
  press,
  settleInView,
  talkUntil,
  tap,
  waitForLabel,
} from "./lib"
import { PARTY_SLOTS } from "../src/lib/wiz/content/constants"

type Flow = { name: string; run: (page: Page) => Promise<void> }

/** 保存を消して、本物の「はじめから」（屋根裏の開幕の場面）で開く。 */
async function startFresh(page: Page) {
  await page.goto(BASE_URL)
  await page.evaluate(() => localStorage.clear())
  await page.goto(BASE_URL)
}

function expect(ok: boolean, message: string) {
  if (!ok) throw new Error(message)
}

const flows: Flow[] = [
  {
    name: "bag",
    // バッグはボタンで開き、もう一度押すと閉じる。「閉じる」でも閉じる
    run: async (page) => {
      await openPreview(page, "town", false)
      await tap(page, page.locator(".bagbtn"))
      await page.getByText("閉じる").first().waitFor()
      await tap(page, page.locator(".bagbtn"))
      await page.waitForTimeout(1200)
      expect(
        (await page.locator(".row").count()) === 0,
        "バッグのボタンで閉じない"
      )
      await tap(page, page.locator(".bagbtn"))
      await tap(page, page.getByText("閉じる").first())
      await page.waitForTimeout(1200)
      expect((await page.locator(".row").count()) === 0, "閉じるで閉じない")
    },
  },
  {
    name: "target",
    // 回復薬は下の仲間の札から「これ」で選ぶ。効かない相手（満タン）は選べない
    run: async (page) => {
      await openPreview(page, "bag-hurt", false)
      await tap(page, page.locator(".row", { hasText: "回復薬" }).first())
      await press(page, "使う")
      await page.locator(".card .aim").first().waitFor()
      const hurt = (await labels(page)).filter((label) => {
        const found = /HP(\d+)\/(\d+)/.exec(label)
        return !!found && found[1] !== found[2]
      }).length
      expect(hurt > 0, "HPが減った仲間がいない（場面の前提が変わった）")
      expect(
        (await page.locator(".card .aim").count()) === hurt,
        `「これ」がHPの減った仲間の数（${hurt}）と合わない`
      )
      const target = page
        .locator(".card", { has: page.locator(".aim") })
        .first()
        .locator(".hit")
      await tap(page, target)
      await page.waitForTimeout(800)
      expect(
        (await page.locator(".target-dim").count()) === 0,
        "選んでも暗いまま"
      )
    },
  },
  {
    name: "battle",
    // 戦闘を武器のワザ（残りが尽きたら「殴る」）で勝ち、戦利品の板が出る
    run: async (page) => {
      await openPreview(page, "battle-two", false)
      expect(
        (await page.locator(".bagbtn").count()) === 0,
        "戦闘中にバッグが出ている"
      )
      for (let step = 0; step < 60; step++) {
        const now = await labels(page)
        if (now.includes("OK")) return
        // ワザは狙っている敵を押して放つ。「殴る」は使える手が尽きたときだけ出る
        const brawl = now.find((label) => label.startsWith("殴る"))
        if (brawl) await press(page, brawl, 100)
        else if (await page.locator(FIRE).count()) await fire(page, 100)
        await page.waitForTimeout(1500)
      }
      throw new Error("戦闘が終わらない")
    },
  },
  {
    name: "peek",
    // 戦闘中に仲間の札を押すと詳細が出て、もう一度押すと閉じる
    run: async (page) => {
      await openPreview(page, "battle", false)
      await page.locator(FIRE).waitFor()
      await tap(page, page.locator(".card .hit").first())
      await page.locator(".peek").waitFor()
      await page.waitForTimeout(800)
      await tap(page, page.locator(".peek"))
      await page.waitForTimeout(800)
      expect((await page.locator(".peek").count()) === 0, "詳細が閉じない")
    },
  },
  {
    name: "stand-equip",
    // 街で仲間の札を押すと立ち絵が上がり、「装備」が見えていて押せる
    // 主人公は装備を持たないので、武器と防具を持つ2人目で確かめる
    run: async (page) => {
      await openPreview(page, "town", false)
      await tap(page, page.locator(".card .hit").nth(1))
      await page.locator(".slab").waitFor()
      await waitForLabel(page, (label) => label === "装備")
      const target = page.locator('[aria-label="装備"]').first()
      await settleInView(page, target)
      await page.waitForTimeout(300)
      const box = await target.boundingBox()
      if (!box) throw new Error("「装備」の場所がない")
      // 立ち絵の文字や板に隠れていないこと（真ん中を押すとこのボタンに当たる）
      const hit = await page.evaluate(
        ([x, y]) =>
          document
            .elementFromPoint(x, y)
            ?.closest("[aria-label]")
            ?.getAttribute("aria-label") ?? "",
        [box.x + box.width / 2, box.y + box.height / 2]
      )
      expect(hit === "装備", `「装備」が「${hit}」に隠れている`)
      // 下の黒帯（押す操作は素通りするので上の判定では見つからない）にも掛からないこと
      const band = await page.locator(".letterbox").boundingBox()
      expect(
        !band || box.y + box.height <= band.y + 1,
        "「装備」が下の黒帯に隠れている"
      )
      await tap(page, target)
      await page.locator(".listview").waitFor()
      await page.waitForTimeout(800)
      expect((await page.locator(".row").count()) > 0, "装備の一覧が出ない")
    },
  },
  {
    name: "bag-cards",
    // バッグを開いている間は、札があった場所を押しても何も起きない
    run: async (page) => {
      await openPreview(page, "town", false)
      const card = page.locator(".card .hit").first()
      await settleInView(page, card)
      const box = await card.boundingBox()
      if (!box) throw new Error("札の場所がない")
      await tap(page, page.locator(".bagbtn"))
      await page.getByText("閉じる").first().waitFor()
      await page.waitForTimeout(900)
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
      await page.waitForTimeout(900)
      expect(
        (await page.locator(".slab").count()) === 0,
        "バッグを開いている間に札を押すと立ち絵が出る"
      )
      expect((await page.locator(".row").count()) > 0, "バッグが閉じている")
    },
  },
  {
    name: "repair",
    // 鍛冶屋の「修理」で、減った防具の耐久をまとめて直す
    run: async (page) => {
      await openPreview(page, "smithy-repair", false)
      await press(page, "修理")
      await tap(page, page.locator(".row", { hasText: "全部直す" }).first())
      await waitForLabel(page, (label) => label.endsWith("で全部直す"))
      const action = (await labels(page)).find((label) =>
        label.endsWith("で全部直す")
      )!
      await press(page, action)
      await page.waitForTimeout(1500)
      const after = await labels(page)
      expect(
        !after.includes("全部直す"),
        "直しても「全部直す」が残っている（耐久が戻っていない）"
      )
      expect(
        (await page.locator(".row", { hasText: "満タン" }).count()) > 0,
        "直した防具が「満タン」にならない"
      )
    },
  },
  {
    name: "demon-contract-room",
    // 加入・支払い・会話の完了は demon-contracts.ts で3幅の実操作を検証する。
    run: async (page) => {
      await openPreview(page, "guild", false)
      await press(page, "秘密の部屋")
      // タブは読み上げの名前を持たないボタンなので、文字で押す
      const tab = (name: string) =>
        tap(page, page.getByRole("button", { name, exact: true }))
      await tab("新しい出会い")
      await tab("仲間と話す")
      await press(page, "‹ 戻る")
      await page
        .locator('[aria-label="悪魔との契約"]')
        .waitFor({ state: "detached" })
    },
  },
  {
    name: "talk",
    // ギルドの受付で受付嬢と会話し、窓が出る
    run: async (page) => {
      await openPreview(page, "reception", false)
      await press(page, "会話")
      await page.locator(".talkbox").waitFor()
    },
  },
  {
    name: "reforge",
    // 鍛冶屋の「鍛え直し」で、拾った武器を素材にして固有の武器を打ち直す
    run: async (page) => {
      await openPreview(page, "smithy-reforge", false)
      await press(page, "鍛え直し")
      const before = await page.locator(".row").count()
      await tap(page, page.locator(".row").first())
      await waitForLabel(page, (label) => label === "素材にして打ち直す")
      await press(page, "素材にして打ち直す")
      await page.waitForTimeout(1500)
      expect(
        (await page.locator(".row").count()) === before - 1,
        "素材にした武器が消えていない"
      )
    },
  },
  {
    name: "result",
    // 全滅の結果と踏破（エンディング）は、押すと閉じて街へ戻る
    run: async (page) => {
      await openPreview(page, "result-wipe", false)
      await waitForLabel(page, (label) => label === "街へ")
      await press(page, "街へ")
      await page.waitForTimeout(1500)
      expect(
        (await page.locator(".result").count()) === 0,
        "全滅の結果が閉じない"
      )
      await openPreview(page, "result-ending", false)
      await waitForLabel(page, (label) => label === "まだ潜る")
      await press(page, "まだ潜る")
      await page.waitForTimeout(1500)
      expect(
        (await page.locator(".result").count()) === 0,
        "踏破の結果が閉じない"
      )
    },
  },
  {
    name: "create",
    // 開幕は会話だけ。ギルドの受付の登録用紙で名前と写真（容姿）を決める
    run: async (page) => {
      await startFresh(page)
      await page.locator("[data-conversation-dialog]").waitFor()
      expect(
        (await page.getByRole("textbox").count()) === 0,
        "開幕の場面に名前入力がある"
      )
      const registration = page.getByRole("region", {
        name: "冒険者の登録用紙",
        exact: true,
      })
      await talkUntil(page, registration)
      await registration
        .getByRole("textbox", { name: "名前（カタカナ）", exact: true })
        .fill("ノア")
      const photo = (await labels(page)).find(
        (label) => label.startsWith("写真 ") && label.endsWith(" を貼る")
      )!
      const chosen = photo.replace(/^写真 (.+) を貼る$/, "$1")
      await press(page, photo)
      await waitForLabel(page, (label) => label === `貼った写真 ${chosen}`)
      await press(page, "この内容で登録する")
      // 名前は隊列の札に出る
      await waitForLabel(page, (label) => label.startsWith("ノア HP"), 20_000)
    },
  },
  {
    name: "depart",
    // はじめから：登録すると、最初からいる3人で街はずれから初出撃する
    run: async (page) => {
      await startFresh(page)
      const registration = page.getByRole("region", {
        name: "冒険者の登録用紙",
        exact: true,
      })
      await talkUntil(page, registration)
      await registration
        .getByRole("textbox", { name: "名前（カタカナ）", exact: true })
        .fill("ノア")
      await press(page, "この内容で登録する")
      await talkUntil(
        page,
        page.getByRole("button", { name: "進む", exact: true })
      )
      const party = (await labels(page)).filter((label) =>
        / HP\d+\/\d+/.test(label)
      )
      expect(
        party.length === PARTY_SLOTS && party[0].startsWith("ノア HP"),
        `${PARTY_SLOTS}人で出撃していない: ${party.join(" / ")}`
      )
    },
  },
]

const only = process.argv.slice(2)
const browser = await launch()
let failed = 0
for (const viewport of VIEWPORTS)
  for (const flow of flows.filter(
    (entry) => !only.length || only.includes(entry.name)
  )) {
    const errors: string[] = []
    const page = await openPage(browser, viewport, errors)
    try {
      await flow.run(page)
      if (errors.length) throw new Error(errors.join("\n"))
      console.log(`ok ${flow.name} (${viewport.name})`)
    } catch (error) {
      failed++
      console.log(
        `NG ${flow.name} (${viewport.name}): ${(error as Error).message.split("\n")[0]}`
      )
      await page
        .screenshot({
          path: `node_modules/.cache/visual/flow-${flow.name}-${viewport.name}.png`,
        })
        .catch(() => {})
    }
    await page.close()
  }
await browser.close()
if (failed) process.exitCode = 1
