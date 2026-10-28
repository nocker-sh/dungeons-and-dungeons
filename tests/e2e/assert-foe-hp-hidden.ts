import type { Page } from "playwright"

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
