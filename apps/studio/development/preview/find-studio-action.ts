/** 無効・不可視・他の部品の背後にある操作対象を除く。 */
export function findStudioAction(label: string) {
  const targets = [
    ...document.querySelectorAll<HTMLElement>("[aria-label], [data-action]"),
  ].filter(
    (element) =>
      // 場面・隊列などの表示用ラベルは、子のボタンに当たっても操作ではない。
      element.matches('button, [role="button"], [data-action]') &&
      (element.getAttribute("aria-label") === label ||
        element.getAttribute("data-action") === label) &&
      !element.matches(":disabled, [disabled]") &&
      !element.closest('[inert], [aria-disabled="true"]') &&
      getComputedStyle(element).display !== "none"
  )
  // 真ん中から外へ、要素の中で他の部品に隠れていない点を探す（見えている所を押す）
  const reachable = (element: HTMLElement) => {
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return false
    const steps = [0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9]
    return steps.some((across) =>
      steps.some((down) => {
        const x = rect.x + rect.width * across
        const y = rect.y + rect.height * down
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return false
        const hit = document.elementFromPoint(x, y)
        return hit !== null && (hit === element || element.contains(hit))
      })
    )
  }
  return targets.find(reachable)
}
