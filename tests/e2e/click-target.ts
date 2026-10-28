import assert from "node:assert/strict"
import { launch } from "@/tests/e2e/launch"
import { tap } from "@/tests/e2e/tap"

// クリックの共通処理が、座標上の別要素を押して成功扱いにしないことを確認する。
const browser = await launch()
try {
  for (const mode of ["covered", "clipped", "pulsing", "moves"] as const) {
    const page = await browser.newPage({
      viewport: { width: 390, height: 400 },
    })
    await page.setContent(`
      <style>@keyframes pulse { 0%,100% { scale:1 } 50% { scale:1.07 } }
      ${mode === "pulsing" ? "#target { animation:pulse .8s infinite }" : ""}</style>
      <div style="position:absolute;left:20px;top:20px;width:180px;height:80px;overflow:clip">
        <button id="target" style="position:absolute;left:${mode === "clipped" ? 220 : 20}px;top:10px;width:100px;height:44px">対象</button>
      </div>
      ${mode === "covered" ? '<div id="cover" style="position:absolute;inset:0;background:white">入場中</div>' : ""}
      ${mode === "moves" ? '<div id="cover" style="display:none;position:absolute;inset:0;background:white">移動後の覆い</div>' : ""}
    `)
    await page.evaluate((mode) => {
      const clicks: string[] = []
      Object.assign(window, { targetClicks: clicks })
      document.addEventListener("click", (event) => {
        clicks.push((event.target as HTMLElement).id)
      })
      if (mode === "moves")
        document.addEventListener(
          "pointermove",
          () => {
            document.getElementById("cover")!.style.display = "block"
          },
          { once: true }
        )
      setTimeout(() => {
        if (mode === "covered") document.getElementById("cover")!.remove()
        else if (mode === "clipped")
          document.getElementById("target")!.style.left = "20px"
      }, 750)
    }, mode)
    const target = page.getByRole("button", { name: "対象", exact: true })
    if (mode === "moves")
      await assert.rejects(
        () => tap(page, target),
        /クリックが対象に届かなかった/
      )
    else await tap(page, target)
    assert.deepEqual(
      await page.evaluate(
        () => (window as unknown as { targetClicks: string[] }).targetClicks
      ),
      [mode === "moves" ? "cover" : "target"],
      `${mode}: 押せない対象の代わりに別の要素をクリックした`
    )
    if (mode === "pulsing")
      assert.equal(
        await target.evaluate((el) => el.getAnimations()[0]?.playState),
        "running"
      )
    console.log(
      `${mode}: ${mode === "moves" ? "直前に外れたクリックを失敗として検知" : "押せる状態を待ち、対象だけを1回クリック"} OK`
    )
    await page.close()
  }
} finally {
  await browser.close()
}
