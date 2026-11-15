/** 立ち絵の横位置。1人は中央、2人は左右、3人は横に並べる。 */
export function portraitLeft(count: number, index: number) {
  if (count === 1) return "14%"
  if (count === 2) return index ? "50%" : "0%"
  return `${index * 31}%`
}
