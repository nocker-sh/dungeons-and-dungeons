/// <reference types="node" />
/**
 * ブラウザで画面を確かめる台本の共通部分。開発サーバー（portless）が動いている前提。
 *   E2E_BASE_URL で相手を変えられる（既定は https://dnd.localhost）
 */
import { chromium, type Browser, type Page } from "playwright"

export const BASE_URL = (
  process.env.E2E_BASE_URL ?? "https://dnd.localhost"
).replace(/\/$/, "")

/** スマホ（縦長）とPC（横長）。 */
export const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
] as const

/** 見た目の乱数（崩れた形など）を固定する。 */
const SEED_RANDOM = `(() => { let s = 12345; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } })()`

export async function launch() {
  return chromium.launch()
}

export async function openPage(
  browser: Browser,
  viewport: { width: number; height: number },
  errors: string[] = []
) {
  const page = await browser.newPage({
    viewport,
    ignoreHTTPSErrors: true,
    deviceScaleFactor: 1,
  })
  await page.addInitScript(SEED_RANDOM)
  page.on("pageerror", (error) => errors.push(`${page.url()} ${error.message}`))
  page.on("console", (message) => {
    if (message.type() === "error")
      errors.push(`${page.url()} ${message.text().slice(0, 200)}`)
  })
  return page
}

/** /previews の場面の一覧。 */
export async function previewSlugs(browser: Browser) {
  const page = await browser.newPage({ ignoreHTTPSErrors: true })
  await page.goto(`${BASE_URL}/previews`)
  const slugs = await page.$$eval("li a", (links) =>
    links.map((link) => link.textContent ?? "")
  )
  await page.close()
  return slugs.filter(Boolean)
}

/** 場面を開いて落ち着かせる（入りの演出は早送り、繰り返しの動きは止める）。 */
export async function openPreview(page: Page, slug: string, still = true) {
  await page.goto(`${BASE_URL}/previews/${slug}${still ? "?still" : ""}`)
  await page.waitForTimeout(1900)
  if (still)
    await page.evaluate(() => {
      for (const animation of document.getAnimations()) {
        if (animation.effect?.getTiming().iterations === Infinity) {
          animation.pause()
          animation.currentTime = 0
        } else animation.finish()
      }
    })
}

/** 要素が画面の中に入り、動きが止まるまで待つ（画面外から飛び込んでくる途中は押せない）。 */
export async function settleInView(
  page: Page,
  target: ReturnType<Page["locator"]>,
  timeout = 20_000
) {
  await target.waitFor({ timeout })
  const viewport = page.viewportSize() ?? { width: 0, height: 0 }
  const until = Date.now() + timeout
  let last = ""
  while (Date.now() < until) {
    const box = await target.boundingBox()
    if (box) {
      const cx = box.x + box.width / 2
      const cy = box.y + box.height / 2
      const key = `${Math.round(box.x)},${Math.round(box.y)}`
      const inside =
        cx > 0 && cy > 0 && cx < viewport.width && cy < viewport.height
      if (inside && key === last) return
      last = key
    }
    await page.waitForTimeout(120)
  }
  throw new Error("画面の中で止まらない")
}

/** aria-label で押す。画面の中で止まるまで待ってから押す。 */
export async function press(page: Page, label: string, settle = 200) {
  const target = page.locator(`[aria-label="${label}"]`).first()
  await settleInView(page, target)
  await page.waitForTimeout(settle)
  await tap(page, target)
}

/** 要素を押す（画面の中で止まるまで待ち、見えている部分の中心を押す）。 */
export async function tap(page: Page, target: ReturnType<Page["locator"]>) {
  await settleInView(page, target)
  const box = await target.boundingBox()
  const viewport = page.viewportSize()
  if (!box || !viewport) throw new Error("押す場所がない")
  const left = Math.max(0, box.x)
  const right = Math.min(viewport.width, box.x + box.width)
  const top = Math.max(0, box.y)
  const bottom = Math.min(viewport.height, box.y + box.height)
  await page.mouse.click((left + right) / 2, (top + bottom) / 2)
}

/** 今の画面で押せる・読める名前（aria-label）。 */
export async function labels(page: Page) {
  return page.$$eval("[aria-label]", (elements) =>
    elements.map((element) => element.getAttribute("aria-label") ?? "")
  )
}

export async function waitForLabel(
  page: Page,
  match: (label: string) => boolean,
  timeout = 15_000
) {
  const until = Date.now() + timeout
  while (Date.now() < until) {
    if ((await labels(page)).some(match)) return
    await page.waitForTimeout(200)
  }
  throw new Error("出てこない")
}

/** 狙っている敵（押すと選んでいるワザを放つ）。 */
export const FIRE = '[data-action="放つ"]'

/**
 * 狙っている敵を押して、選んでいるワザを放つ。
 * 敵の絵は大きく、真ん中に指示の板が重なることがあるので、押して敵に当たる場所（中心に近い順）を押す。
 */
export async function fire(page: Page, settle = 200) {
  const target = page.locator(FIRE).first()
  await settleInView(page, target)
  await page.waitForTimeout(settle)
  const point = await target.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const left = Math.max(0, box.left)
    const right = Math.min(innerWidth, box.right)
    const top = Math.max(0, box.top)
    const bottom = Math.min(innerHeight, box.bottom)
    const center = { x: (left + right) / 2, y: (top + bottom) / 2 }
    const points: { x: number; y: number }[] = []
    for (let row = 1; row < 12; row++)
      for (let column = 1; column < 12; column++)
        points.push({
          x: left + ((right - left) * column) / 12,
          y: top + ((bottom - top) * row) / 12,
        })
    points.sort(
      (a, b) =>
        Math.hypot(a.x - center.x, a.y - center.y) -
        Math.hypot(b.x - center.x, b.y - center.y)
    )
    const found = [center, ...points].find((point) =>
      element.contains(document.elementFromPoint(point.x, point.y))
    )
    // 押せないときは、敵を覆っている物を失敗の文に出す
    const covers = new Set(
      [center, ...points].map((point) => {
        const cover = document.elementFromPoint(point.x, point.y)
        return cover
          ? `${cover.tagName}.${cover.className} ${cover.closest("[aria-label]")?.getAttribute("aria-label") ?? ""}`
          : "なし"
      })
    )
    return { found, cover: [...covers].slice(0, 4).join(" / ") }
  })
  if (!point.found) {
    await page.screenshot({ path: "/tmp/dnd-fire-failure.png" })
    throw new Error(`狙っている敵に押せる場所がない（真ん中: ${point.cover}）`)
  }
  await page.mouse.click(point.found.x, point.found.y)
}

/** 敵の名前・HPの数字・ゲージを画面に出していないこと（行動順の絵にも名前を書かない）。 */
export async function assertFoeHpHidden(page: Page, names: readonly string[]) {
  const shown = await page.evaluate(
    (names) => ({
      hp: document.querySelectorAll(".game .hpnum, .game .gauge").length,
      named: [...document.querySelectorAll<HTMLElement>(".game .foe, .order")]
        .map((element) => element.innerText)
        .filter((text) => names.some((name) => name && text.includes(name))),
    }),
    names
  )
  if (shown.hp) throw new Error("敵のHPの数字・ゲージが出ている")
  if (shown.named.length)
    throw new Error(`敵の名前が出ている: ${shown.named.join(" / ")}`)
}

/**
 * 会話を実UIで進め（選択肢は先頭）、会話が終わって目当ての物が出るまで待つ。
 * はじめから遊ぶ流れのように、会話と場面の切り替えが自動で続く所で使う。
 */
export async function talkUntil(
  page: Page,
  target: ReturnType<Page["locator"]>,
  timeout = 90_000
) {
  const dialog = page.locator("[data-conversation-dialog]")
  const until = Date.now() + timeout
  while (Date.now() < until) {
    const talking = await dialog.count()
    // 会話は続けて流れることがあるので、少し待っても次の会話が始まらないことを確かめる
    if (!talking && (await target.count())) {
      await page.waitForTimeout(1200)
      if (!(await dialog.count()) && (await target.count())) return
      continue
    }
    if (talking) {
      const confirm = dialog.locator('[role="group"] button').first()
      const next = dialog.getByRole("button", {
        name: "会話を進める",
        exact: true,
      })
      // 選択肢は滑り込んでくるので、画面の中で止まってから押す
      if (await confirm.count()) await tap(page, confirm)
      else if ((await next.count()) && (await next.isEnabled()))
        await page.keyboard.press("Enter")
    }
    await page.waitForTimeout(150)
  }
  throw new Error("会話を進めても出てこない")
}
