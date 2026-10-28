export type Rectangle = { x: number; y: number; w: number; d: number }

/** 床の分割線は壁ではないため、複数の矩形を合わせた床全体で包含を判定する。 */
export function coversRectangle(
  floor: readonly Rectangle[],
  item: Rectangle
): boolean {
  const right = item.x + item.w
  const bottom = item.y + item.d
  const xs = [
    ...new Set([
      item.x,
      right,
      ...floor
        .flatMap((part) => [part.x, part.x + part.w])
        .filter((x) => x > item.x && x < right),
    ]),
  ].sort((a, b) => a - b)
  const ys = [
    ...new Set([
      item.y,
      bottom,
      ...floor
        .flatMap((part) => [part.y, part.y + part.d])
        .filter((y) => y > item.y && y < bottom),
    ]),
  ].sort((a, b) => a - b)
  for (let i = 1; i < xs.length; i++)
    for (let j = 1; j < ys.length; j++) {
      const x = (xs[i - 1] + xs[i]) / 2
      const y = (ys[j - 1] + ys[j]) / 2
      if (
        !floor.some(
          (part) =>
            x >= part.x &&
            x <= part.x + part.w &&
            y >= part.y &&
            y <= part.y + part.d
        )
      )
        return false
    }
  return true
}
